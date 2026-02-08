import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextResponse } from 'next/server';

// POST /api/social/sync - Sync connected accounts from Upload-Post to our DB
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = user.id.replace(/-/g, '_');

  try {
    const client = getUploadPostClient();
    const result = await client.listUsers();

    if (!result.success || !result.profiles) {
      return NextResponse.json({ accounts: [] });
    }

    const profile = result.profiles.find(
      (p: { username?: string }) => p.username === username
    );

    if (!profile?.social_accounts) {
      return NextResponse.json({ accounts: [] });
    }

    const accounts = Object.entries(profile.social_accounts as Record<string, { name?: string }>).map(
      ([platform, data]) => ({
        profile_id: user.id,
        platform,
        account_name: data?.name || null,
      })
    );

    for (const acc of accounts) {
      await supabase.from('social_accounts').upsert(
        { ...acc, connected_at: new Date().toISOString() },
        { onConflict: 'profile_id,platform' }
      );
    }

    const { data: synced } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('profile_id', user.id);

    return NextResponse.json({ accounts: synced || [] });
  } catch {
    return NextResponse.json({ accounts: [] });
  }
}
