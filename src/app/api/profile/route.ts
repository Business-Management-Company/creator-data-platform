import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/profile - Get current user's profile
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(profile);
}

// PATCH /api/profile - Update profile (bio settings, theme, etc.)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowed = [
    'bio_slug', 'bio_title', 'bio_description', 'theme', 'bio_text', 'display_name',
    'avatar_url', 'social_links', 'page_settings',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (updates.bio_slug) {
    const slug = String(updates.bio_slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('bio_slug', slug)
        .neq('id', user.id)
        .single();
      if (existing) {
        return NextResponse.json({ error: 'That slug is already taken. Try another!' }, { status: 409 });
      }
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(profile);
}
