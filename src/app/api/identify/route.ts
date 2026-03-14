import { createAdminSupabase } from '@/lib/supabase/server';
import { enrichByEmail, shouldOverwrite, logIdentityEvent, CONFIDENCE } from '@/lib/pdl';
import { NextRequest, NextResponse } from 'next/server';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

// POST /api/identify
// Called when a visitor provides their email (form, signup, etc.)
// Layer 3: Email capture → PDL person enrichment → visitor stitching
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pixel_id, visitor_id, fingerprint, email } = body;

    if (!pixel_id || !email || !visitor_id) {
      return NextResponse.json({ status: 'error', message: 'pixel_id, visitor_id, and email required' }, { status: 400, headers: cors });
    }

    // Respond fast, process async
    processIdentify(pixel_id, visitor_id, fingerprint, email, request);

    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  }
}

async function processIdentify(
  pixelId: string,
  visitorId: string,
  fingerprint: string | null,
  email: string,
  request: NextRequest
) {
  try {
    const supabase = createAdminSupabase();
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Look up creator
    const { data: creator } = await supabase
      .from('profiles')
      .select('id')
      .eq('pixel_id', pixelId)
      .single();
    if (!creator) return;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || null;

    // 2. Find existing visitor
    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, confidence_score, identity_source, email, full_name, company, job_title, linkedin_url, fingerprint_hashes, ip_addresses')
      .eq('user_id', creator.id)
      .eq('visitor_id', visitorId)
      .single();

    if (!visitor) return;

    const dataBefore = {
      email: visitor.email,
      full_name: visitor.full_name,
      company: visitor.company,
      identity_source: visitor.identity_source,
      confidence_score: visitor.confidence_score,
    };

    // 3. Call PDL Person Enrichment (Layer 3)
    const pdlResult = await enrichByEmail(trimmedEmail);

    const updates: Record<string, any> = {
      email: trimmedEmail,
      identified: true,
    };

    if (pdlResult && pdlResult.full_name) {
      // Full PDL enrichment succeeded — highest confidence
      if (shouldOverwrite(visitor.identity_source, visitor.confidence_score || 0, 'email_pdl')) {
        updates.full_name = pdlResult.full_name;
        updates.company = pdlResult.company || visitor.company;
        updates.job_title = pdlResult.job_title || visitor.job_title;
        updates.linkedin_url = pdlResult.linkedin_url || visitor.linkedin_url;
        updates.confidence_score = CONFIDENCE.email_pdl;
        updates.identity_source = 'email_pdl';
        updates.enriched_at = new Date().toISOString();
      }
    } else {
      // PDL didn't return results, but we still have the email
      if (shouldOverwrite(visitor.identity_source, visitor.confidence_score || 0, 'email')) {
        updates.confidence_score = CONFIDENCE.email;
        updates.identity_source = 'email';
      }
    }

    await supabase.from('visitors').update(updates).eq('id', visitor.id);

    // 4. Audit log
    await logIdentityEvent(
      creator.id, visitorId,
      pdlResult ? 'pdl_email' : 'email_capture',
      updates.confidence_score || CONFIDENCE.email,
      updates.identity_source || 'email',
      dataBefore,
      { email: trimmedEmail, full_name: updates.full_name, company: updates.company }
    );

    // 5. Stitch: find other visitor records with same fingerprint or IP
    //    and merge identity data into them
    if (fingerprint || ip) {
      let mergeQuery = supabase
        .from('visitors')
        .select('id, visitor_id, email, identified')
        .eq('user_id', creator.id)
        .neq('id', visitor.id)
        .or(
          [
            fingerprint ? `fingerprint_hashes.cs.{${fingerprint}}` : null,
            ip ? `ip_addresses.cs.{${ip}}` : null,
          ].filter(Boolean).join(',')
        );

      const { data: relatedVisitors } = await mergeQuery;

      if (relatedVisitors && relatedVisitors.length > 0) {
        for (const related of relatedVisitors) {
          if (!related.email && !related.identified) {
            // Merge identity into the related anonymous record
            await supabase.from('visitors').update({
              email: trimmedEmail,
              full_name: updates.full_name || null,
              company: updates.company || null,
              job_title: updates.job_title || null,
              linkedin_url: updates.linkedin_url || null,
              identified: true,
              identity_source: updates.identity_source || 'email',
              confidence_score: updates.confidence_score || CONFIDENCE.email,
              enriched_at: new Date().toISOString(),
            }).eq('id', related.id);

            await logIdentityEvent(
              creator.id, related.visitor_id, 'fingerprint_merge',
              updates.confidence_score || CONFIDENCE.email,
              'email',
              { email: null, identified: false },
              { email: trimmedEmail, merged_from: visitorId }
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Identify processing error:', error);
  }
}
