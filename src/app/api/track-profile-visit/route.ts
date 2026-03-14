import { createAdminSupabase } from '@/lib/supabase/server';
import { extractDomain } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

const cors = {
  'Access-Control-Allow-Origin': 'https://milcrunch.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creator_handle,
      visitor_fingerprint,
      ip,
      page_url,
      referrer,
      device,
      browser,
      country,
      city,
    } = body;

    if (!creator_handle || !visitor_fingerprint) {
      return NextResponse.json({ error: 'Missing creator_handle or visitor_fingerprint' }, { status: 400, headers: cors });
    }

    const supabase = createAdminSupabase();

    // Look up creator by handle (bio_slug)
    const { data: creator } = await supabase
      .from('profiles')
      .select('id, pixel_id')
      .eq('bio_slug', creator_handle)
      .single();

    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404, headers: cors });
    }

    const visitorId = `mc_${visitor_fingerprint}`;
    const now = new Date().toISOString();

    // Insert page view event
    await supabase.from('page_view_events').insert({
      creator_id: creator.id,
      visitor_id: visitorId,
      pixel_id: creator.pixel_id,
      page_url: page_url || null,
      referrer_url: referrer || null,
      referrer_domain: referrer ? extractDomain(referrer) : null,
      country: country || null,
      city: city || null,
      ip_address: ip || '0.0.0.0',
      device_type: device || null,
      browser: browser || null,
      fingerprint_hash: visitor_fingerprint,
    });

    // Upsert visitor record
    const { data: existingVisitor } = await supabase
      .from('visitors')
      .select('id, fingerprint_hashes, ip_addresses, total_page_views, first_page_url')
      .eq('user_id', creator.id)
      .eq('visitor_id', visitorId)
      .single();

    if (existingVisitor) {
      const fps: string[] = existingVisitor.fingerprint_hashes || [];
      const ips: string[] = existingVisitor.ip_addresses || [];
      if (visitor_fingerprint && !fps.includes(visitor_fingerprint)) fps.push(visitor_fingerprint);
      if (ip && !ips.includes(ip)) ips.push(ip);

      await supabase.from('visitors').update({
        fingerprint_hashes: fps,
        ip_addresses: ips,
        total_page_views: (existingVisitor.total_page_views || 0) + 1,
        last_seen_at: now,
        last_page_url: page_url || null,
        inferred_location: city && country ? `${city}, ${country}` : country || null,
      }).eq('id', existingVisitor.id);
    } else {
      await supabase.from('visitors').insert({
        user_id: creator.id,
        visitor_id: visitorId,
        fingerprint_hashes: visitor_fingerprint ? [visitor_fingerprint] : [],
        ip_addresses: ip ? [ip] : [],
        total_clicks: 0,
        total_page_views: 1,
        first_page_url: page_url || null,
        last_page_url: page_url || null,
        inferred_location: city && country ? `${city}, ${country}` : country || null,
        device_types: device ? [device] : [],
        enrichment_attempts: 0,
      });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  } catch (error) {
    console.error('Track profile visit error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  }
}
