import { createAdminSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import BioPageClient from '@/components/bio/BioPageClient';

// This is the public-facing bio page: yourdomain.com/[slug]
// It's server-rendered for SEO, then hydrated client-side for tracking

export default async function BioPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();

  // Look up the profile by slug
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, bio_slug, bio_title, bio_description, bio_theme, avatar_url')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) {
    notFound();
  }

  // Get their bio links
  const { data: links } = await supabase
    .from('links')
    .select('id, title, short_code, destination_url, bio_icon, bio_order')
    .eq('user_id', profile.id)
    .eq('is_bio_link', true)
    .eq('is_active', true)
    .order('bio_order', { ascending: true });

  return (
    <BioPageClient
      profile={{
        title: profile.bio_title || 'My Links',
        description: profile.bio_description || '',
        theme: profile.bio_theme || { bg: '#ffffff', text: '#000000', accent: '#3361FF', style: 'minimal' },
        avatarUrl: profile.avatar_url || '',
      }}
      links={(links || []).map((l) => ({
        id: l.id,
        title: l.title,
        shortCode: l.short_code,
        destinationUrl: l.destination_url,
        icon: l.bio_icon,
      }))}
    />
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createAdminSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('bio_title, bio_description')
    .eq('bio_slug', params.slug)
    .single();

  if (!profile) return {};

  return {
    title: profile.bio_title || 'Links',
    description: profile.bio_description || '',
  };
}
