import { createAdminSupabase } from '@/lib/supabase/server';
import { extractDomain } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import UAParser from 'ua-parser-js';

// This endpoint receives click/tracking data from:
// 1. The smart link redirect page (client-side fingerprint + server-side headers)
// 2. The site pixel (future Phase 2)
// 3. The email pixel (future Phase 3)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { link_code, fingerprint, referrer } = body;

    if (!link_code) {
      return NextResponse.json({ error: 'link_code required' }, { status: 400 });
    }

    const supabase = createAdminSupabase();

    // 1. Look up the link
    const { data: link, error: linkError } = await supabase
      .from('links')
      .select('id, user_id, destination_url, ab_enabled, ab_destination_url, ab_split')
      .eq('short_code', link_code)
      .eq('is_active', true)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // 2. Parse user agent from headers
    const userAgent = request.headers.get('user-agent') || '';
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();

    // 3. Get IP and geo (Vercel provides these headers)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '0.0.0.0';
    const country = request.headers.get('x-vercel-ip-country') || null;
    const region = request.headers.get('x-vercel-ip-country-region') || null;
    const city = request.headers.get('x-vercel-ip-city') || null;

    // 4. Determine A/B variant
    let abVariant: 'A' | 'B' | null = null;
    let finalDestination = link.destination_url;
    if (link.ab_enabled && link.ab_destination_url) {
      abVariant = Math.random() * 100 < link.ab_split ? 'A' : 'B';
      finalDestination = abVariant === 'A' ? link.destination_url : link.ab_destination_url;
    }

    // 5. Generate or use visitor ID
    const visitorId = fingerprint?.fingerprint_hash || `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 6. Insert click event
    const clickEvent = {
      link_id: link.id,
      user_id: link.user_id,
      visitor_id: visitorId,
      fingerprint_hash: fingerprint?.fingerprint_hash || null,
      ip_address: ip,
      country,
      region,
      city,
      device_type: ua.device.type || 'desktop',
      os_name: ua.os.name || null,
      os_version: ua.os.version || null,
      browser_name: ua.browser.name || null,
      browser_version: ua.browser.version || null,
      screen_resolution: fingerprint?.screen_resolution || null,
      language: fingerprint?.language || null,
      timezone: fingerprint?.timezone || null,
      referrer_url: referrer || null,
      referrer_domain: referrer ? extractDomain(referrer) : null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null,
      ab_variant: abVariant,
    };

    await supabase.from('click_events').insert(clickEvent);

    // 7. Increment link click counter
    await supabase.rpc('increment_link_clicks', { link_uuid: link.id });

    // 8. Update daily analytics
    const now = new Date();
    await supabase.rpc('upsert_daily_analytics', {
      p_user_id: link.user_id,
      p_link_id: link.id,
      p_date: now.toISOString().split('T')[0],
      p_country: country || 'Unknown',
      p_device: ua.device.type || 'desktop',
      p_referrer: referrer ? extractDomain(referrer) : 'Direct',
      p_browser: ua.browser.name || 'Unknown',
      p_hour: now.getUTCHours(),
    });

    // 9. Upsert visitor profile (for identity resolution)
    const { data: existingVisitor } = await supabase
      .from('visitors')
      .select('id, fingerprint_hashes, ip_addresses, total_clicks')
      .eq('user_id', link.user_id)
      .eq('visitor_id', visitorId)
      .single();

    if (existingVisitor) {
      // Update existing visitor
      const fingerprints = existingVisitor.fingerprint_hashes || [];
      const ips = existingVisitor.ip_addresses || [];
      if (fingerprint?.fingerprint_hash && !fingerprints.includes(fingerprint.fingerprint_hash)) {
        fingerprints.push(fingerprint.fingerprint_hash);
      }
      if (ip && !ips.includes(ip)) {
        ips.push(ip);
      }

      await supabase
        .from('visitors')
        .update({
          fingerprint_hashes: fingerprints,
          ip_addresses: ips,
          total_clicks: (existingVisitor.total_clicks || 0) + 1,
          last_seen_at: new Date().toISOString(),
          inferred_location: city && region ? `${city}, ${region}` : country,
        })
        .eq('id', existingVisitor.id);
    } else {
      // Create new visitor
      await supabase.from('visitors').insert({
        user_id: link.user_id,
        visitor_id: visitorId,
        fingerprint_hashes: fingerprint?.fingerprint_hash ? [fingerprint.fingerprint_hash] : [],
        ip_addresses: ip ? [ip] : [],
        total_clicks: 1,
        inferred_location: city && region ? `${city}, ${region}` : country,
        device_types: ua.device.type ? [ua.device.type] : ['desktop'],
      });
    }

    // 10. Return the destination URL (the redirect page uses this)
    return NextResponse.json({
      destination: finalDestination,
      ab_variant: abVariant,
    });

  } catch (error: any) {
    console.error('Track error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
