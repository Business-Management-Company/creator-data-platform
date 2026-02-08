import { createAdminSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import BioPageClient from '@/components/bio/BioPageClient';

// Public bio page: yourdomain.com/[slug]
// Rendered with all customizations; links filtered by schedule

export default async function BioPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, bio_slug, bio_title, bio_description, bio_theme, avatar_url, theme, bio_text, display_name, social_links, page_settings')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: links } = await supabase
    .from('links')
    .select('id, title, short_code, destination_url, bio_icon, bio_order, link_order, thumbnail_url, icon, priority, schedule_start, schedule_end')
    .eq('user_id', profile.id)
    .eq('is_bio_link', true)
    .eq('is_active', true)
    .order('link_order', { ascending: true, nullsFirst: false })
    .order('bio_order', { ascending: true });

  const now = new Date();
  const visibleLinks = (links || []).filter((l) => {
    if (l.schedule_start && new Date(l.schedule_start) > now) return false;
    if (l.schedule_end && new Date(l.schedule_end) < now) return false;
    return true;
  });

  const theme = profile.bio_theme || { bg: '#ffffff', text: '#000000', accent: '#3361FF', style: 'minimal' };
  const pageSettings = (profile.page_settings as Record<string, unknown>) || {};

  return (
    <BioPageClient
      profile={{
        title: profile.bio_title || 'My Links',
        description: profile.bio_description || '',
        displayName: profile.display_name || profile.bio_title || '',
        bioText: profile.bio_text || profile.bio_description || '',
        avatarUrl: profile.avatar_url || '',
        theme,
        pageSettings,
        socialLinks: (profile.social_links as Record<string, string>) || {},
      }}
      links={visibleLinks.map((l) => ({
        id: l.id,
        title: l.title,
        shortCode: l.short_code,
        destinationUrl: l.destination_url,
        icon: l.bio_icon || l.icon,
        thumbnailUrl: l.thumbnail_url,
        priority: l.priority || false,
      }))}
      slug={params.slug}
    />
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('bio_title, bio_description, bio_text, display_name')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) return {};

  return {
    title: profile.display_name || profile.bio_title || 'Links',
    description: profile.bio_text || profile.bio_description || '',
  };
}
