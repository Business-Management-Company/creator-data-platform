import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bio-blocks - List user's bio blocks
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: blocks, error } = await supabase
    .from('bio_blocks')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(blocks || []);
}

// POST /api/bio-blocks - Create a new block
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { block_type, position, block_data } = body;

  if (!block_type || !['link', 'youtube', 'spotify', 'text', 'image', 'contact_form'].includes(block_type)) {
    return NextResponse.json({ error: 'Invalid block type' }, { status: 400 });
  }

  const { data: block, error } = await supabase
    .from('bio_blocks')
    .insert({
      user_id: user.id,
      block_type,
      position: typeof position === 'number' ? position : 0,
      block_data: block_data || {},
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(block, { status: 201 });
}
