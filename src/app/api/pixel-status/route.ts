import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/pixel-status — Check if pixel has fired recently (for installation verification)
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get the creator's pixel_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('pixel_id')
    .eq('id', user.id)
    .single();

  if (!profile?.pixel_id) {
    return NextResponse.json({ installed: false, domains: [] });
  }

  // Check for recent events (last 10 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('page_view_events')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', user.id)
    .gte('created_at', fiveMinutesAgo);

  // Get all domains where pixel is installed
  const { data: installs } = await supabase
    .from('pixel_installs')
    .select('domain, last_seen_at, total_events, status')
    .eq('creator_id', user.id)
    .order('last_seen_at', { ascending: false });

  return NextResponse.json({
    installed: (installs?.length || 0) > 0,
    recentActivity: (recentCount || 0) > 0,
    domains: installs || [],
    pixelId: profile.pixel_id,
  });
}
