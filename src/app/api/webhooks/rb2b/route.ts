import { createAdminSupabase } from '@/lib/supabase/server';
import { shouldOverwrite, logIdentityEvent, CONFIDENCE } from '@/lib/pdl';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/webhooks/rb2b
// Layer 1: RB2B sends LinkedIn profile data when a visitor is identified
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = process.env.RB2B_WEBHOOK_SECRET;
    if (secret) {
      const provided = request.headers.get('x-webhook-secret')
        || request.headers.get('authorization')?.replace('Bearer ', '') || '';
      if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const {
      email, first_name, last_name,
      linkedin_url, company_name, job_title,
      city, state, country,
      ip_address, profile_image_url,
      pixel_id, site_id,
    } = body;

    if (!ip_address && !email) {
      return NextResponse.json({ error: 'ip_address or email required' }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;
    const location = [city, state, country].filter(Boolean).join(', ') || null;

    // Find the creator this webhook belongs to
    let creatorId: string | null = null;

    if (pixel_id || site_id) {
      const { data: creator } = await supabase
        .from('profiles')
        .select('id')
        .eq('pixel_id', pixel_id || site_id)
        .single();
      creatorId = creator?.id || null;
    }

    // Fallback: match by IP in recent page views
    if (!creatorId && ip_address) {
      const { data: recentView } = await supabase
        .from('page_view_events')
        .select('creator_id')
        .eq('ip_address', ip_address)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      creatorId = recentView?.creator_id || null;
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'No matching creator' }, { status: 404 });
    }

    // Find visitors with this IP
    let matchCount = 0;

    if (ip_address) {
      const { data: visitors } = await supabase
        .from('visitors')
        .select('id, visitor_id, email, confidence_score, identity_source, full_name, company')
        .eq('user_id', creatorId)
        .contains('ip_addresses', [ip_address]);

      if (visitors) {
        for (const visitor of visitors) {
          // Only overwrite if RB2B confidence is higher than current
          if (!shouldOverwrite(visitor.identity_source, visitor.confidence_score || 0, 'rb2b')) {
            continue;
          }

          const dataBefore = {
            email: visitor.email,
            full_name: visitor.full_name,
            company: visitor.company,
            identity_source: visitor.identity_source,
            confidence_score: visitor.confidence_score,
          };

          await supabase.from('visitors').update({
            email: email || visitor.email,
            full_name: fullName || visitor.full_name,
            company: company_name || visitor.company,
            job_title: job_title || null,
            linkedin_url: linkedin_url || null,
            avatar_url: profile_image_url || null,
            identified: true,
            identity_source: 'rb2b',
            confidence_score: CONFIDENCE.rb2b,
            inferred_location: location,
            enriched_at: new Date().toISOString(),
          }).eq('id', visitor.id);

          await logIdentityEvent(
            creatorId, visitor.visitor_id, 'rb2b_match',
            CONFIDENCE.rb2b, 'rb2b',
            dataBefore,
            { email, full_name: fullName, company: company_name, linkedin_url }
          );

          matchCount++;
        }
      }
    }

    // If no IP match, try email match
    if (matchCount === 0 && email) {
      const { data: visitor } = await supabase
        .from('visitors')
        .select('id, visitor_id, confidence_score, identity_source, full_name, company')
        .eq('user_id', creatorId)
        .eq('email', email)
        .limit(1)
        .single();

      if (visitor && shouldOverwrite(visitor.identity_source, visitor.confidence_score || 0, 'rb2b')) {
        const dataBefore = {
          full_name: visitor.full_name,
          company: visitor.company,
          identity_source: visitor.identity_source,
        };

        await supabase.from('visitors').update({
          full_name: fullName || visitor.full_name,
          company: company_name || visitor.company,
          job_title: job_title || null,
          linkedin_url: linkedin_url || null,
          avatar_url: profile_image_url || null,
          identified: true,
          identity_source: 'rb2b',
          confidence_score: CONFIDENCE.rb2b,
          inferred_location: location,
          enriched_at: new Date().toISOString(),
        }).eq('id', visitor.id);

        await logIdentityEvent(
          creatorId, visitor.visitor_id, 'rb2b_match',
          CONFIDENCE.rb2b, 'rb2b',
          dataBefore,
          { full_name: fullName, company: company_name, linkedin_url }
        );

        matchCount++;
      }
    }

    return NextResponse.json({ status: 'ok', matched: matchCount });

  } catch (error: any) {
    console.error('RB2B webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
