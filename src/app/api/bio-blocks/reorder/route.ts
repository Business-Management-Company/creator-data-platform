import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bio-blocks/reorder - Reorder blocks
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { orderedIds } = body as { orderedIds: string[] };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds array required' }, { status: 400 });
  }

  const updates = orderedIds.map((id, index) =>
    supabase
      .from('bio_blocks')
      .update({ position: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].error?.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
