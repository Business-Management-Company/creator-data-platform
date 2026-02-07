import { createServerSupabase } from '@/lib/supabase/server';
import { generateShortCode, isValidUrl, isUrlSafeSlug } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/links - List user's links
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: links, error } = await supabase
    .from('links')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(links);
}

// POST /api/links - Create a new link
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { destination_url, title, is_bio_link, bio_icon, tags, short_code: customShortCode } = body;

  if (!destination_url || !isValidUrl(destination_url)) {
    return NextResponse.json({ error: 'Valid destination URL required' }, { status: 400 });
  }

  // Check link limits for free plan
  const { count } = await supabase
    .from('links')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profile?.plan === 'free' && (count || 0) >= 25) {
    return NextResponse.json({ error: 'Free plan limited to 25 links. Upgrade to create more.' }, { status: 403 });
  }

  let shortCode: string;
  const trimmedCustom = typeof customShortCode === 'string' ? customShortCode.trim().toLowerCase() : '';
  if (trimmedCustom) {
    if (!isUrlSafeSlug(trimmedCustom)) {
      return NextResponse.json(
        { error: 'Short code must be 3–64 characters, lowercase letters, numbers, and hyphens only. No leading or trailing hyphens.' },
        { status: 400 }
      );
    }
    const { data: existing } = await supabase.from('links').select('id').eq('short_code', trimmedCustom).single();
    if (existing) {
      return NextResponse.json({ error: 'This short code is already taken. Choose another.' }, { status: 409 });
    }
    shortCode = trimmedCustom;
  } else {
    let generated = generateShortCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase.from('links').select('id').eq('short_code', generated).single();
      if (!existing) break;
      generated = generateShortCode();
      attempts++;
    }
    shortCode = generated;
  }

  // Get next bio order if it's a bio link
  let bioOrder = 0;
  if (is_bio_link) {
    const { data: lastBioLink } = await supabase
      .from('links')
      .select('bio_order')
      .eq('user_id', user.id)
      .eq('is_bio_link', true)
      .order('bio_order', { ascending: false })
      .limit(1)
      .single();
    bioOrder = (lastBioLink?.bio_order || 0) + 1;
  }

  const { data: link, error } = await supabase
    .from('links')
    .insert({
      user_id: user.id,
      short_code: shortCode,
      destination_url,
      title: title || destination_url,
      is_bio_link: is_bio_link || false,
      bio_icon: bio_icon || null,
      bio_order: bioOrder,
      tags: tags || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(link, { status: 201 });
}
