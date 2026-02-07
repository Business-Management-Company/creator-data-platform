import { createServerSupabase } from '@/lib/supabase/server';
import { getSlugValidationError } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/links/check-slug?slug=xxx - Check if a short code is valid and available
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = request.nextUrl.searchParams.get('slug');
  const trimmed = typeof slug === 'string' ? slug.trim().toLowerCase() : '';

  if (!trimmed) {
    return NextResponse.json({ available: false, error: 'Enter a short code to check.' });
  }

  const validationError = getSlugValidationError(trimmed);
  if (validationError) {
    return NextResponse.json({ available: false, error: validationError });
  }

  const { data: existing } = await supabase.from('links').select('id').eq('short_code', trimmed).single();
  return NextResponse.json({ available: !existing });
}
