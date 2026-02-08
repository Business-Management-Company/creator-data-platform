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

// POST /api/subscribers - Add subscriber (public bio page form; uses slug)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, email } = body;

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

  const settings = (profile.page_settings as { email_capture?: boolean }) || {};
  if (!settings.email_capture) {
    return NextResponse.json({ error: 'Email capture is not enabled for this page' }, { status: 400 });
  }

  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .upsert(
      { profile_id: profile.id, email: trimmedEmail, source: 'bio_page' },
      { onConflict: 'profile_id,email', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ message: 'Already subscribed!' });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, subscriber: subscriber || { email: trimmedEmail } });
}
