import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/subscribers - List current user's subscribers (requires auth)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscribers, error } = await supabase
    .from('subscribers')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(subscribers || []);
}

// POST /api/subscribers - Add subscriber (bio page email capture or contact form)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, email, name, message, source, visitor_id, fingerprint_hash } = body;

  if (!slug || !email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Slug and valid email required' }, { status: 400 });
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, page_settings')
    .eq('bio_slug', slug)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const isContactForm = source === 'contact_form';

  if (isContactForm) {
    // Contact form: insert into contact_submissions
    const { data: submission, error } = await supabase
      .from('contact_submissions')
      .insert({
        profile_id: profile.id,
        email: trimmedEmail,
        name: typeof name === 'string' ? name.trim() : null,
        message: typeof message === 'string' ? message.trim() : null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, submission });
  }

  // Email capture (bio_page): upsert, one per email
  const settings = (profile.page_settings as { email_capture?: boolean }) || {};
  if (!settings.email_capture) {
    return NextResponse.json({ error: 'Email capture is not enabled for this page' }, { status: 400 });
  }

  const subscriberData: Record<string, any> = {
    profile_id: profile.id,
    email: trimmedEmail,
    source: 'bio_page',
  };
  if (visitor_id) subscriberData.visitor_id = visitor_id;
  if (fingerprint_hash) subscriberData.fingerprint_hash = fingerprint_hash;

  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .upsert(subscriberData, { onConflict: 'profile_id,email', ignoreDuplicates: true })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already subscribed!' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stitch: if visitor_id provided, link email to the visitor record
  if (visitor_id && trimmedEmail) {
    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, email, confidence_score')
      .eq('user_id', profile.id)
      .eq('visitor_id', visitor_id)
      .single();

    if (visitor && !visitor.email) {
      await supabase.from('visitors').update({
        email: trimmedEmail,
        identified: true,
        identity_source: 'email',
        confidence_score: 50,
      }).eq('id', visitor.id);
    }
  }

  return NextResponse.json({ success: true, subscriber: subscriber || { email: trimmedEmail } });
}
