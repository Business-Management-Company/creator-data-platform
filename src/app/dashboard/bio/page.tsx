'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Copy, ExternalLink, GripVertical, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface Profile {
  bio_slug: string | null;
  bio_title: string;
  bio_description: string | null;
  bio_theme: { bg: string; text: string; accent: string; style: string };
}

interface BioLink {
  id: string;
  title: string;
  destination_url: string;
  short_code: string;
  bio_order: number;
  is_active: boolean;
}

export default function BioEditorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioLinks, setBioLinks] = useState<BioLink[]>([]);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('bio_slug, bio_title, bio_description, bio_theme')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setSlug(profileData.bio_slug || '');
      setTitle(profileData.bio_title || '');
      setDescription(profileData.bio_description || '');
    }

    const { data: links } = await supabase
      .from('links')
      .select('id, title, destination_url, short_code, bio_order, is_active')
      .eq('user_id', user.id)
      .eq('is_bio_link', true)
      .order('bio_order', { ascending: true });

    setBioLinks(links || []);
    setLoading(false);
  }

  async function saveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        bio_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        bio_title: title,
        bio_description: description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      if (error.code === '23505') {
        toast.error('That slug is already taken. Try another!');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Bio page saved!');
    }
    setSaving(false);
  }

  function copyBioUrl() {
    if (slug) {
      navigator.clipboard.writeText(`${appUrl}/${slug}`);
      toast.success('Bio page URL copied!');
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bio Page</h1>
          <p className="text-gray-500 mt-1">Your link-in-bio page with built-in tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          {slug && (
            <>
              <button onClick={copyBioUrl} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
                <Copy className="w-4 h-4" /> Copy URL
              </button>
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
              >
                <ExternalLink className="w-4 h-4" /> Preview
              </a>
            </>
          )}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Page Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-400 mr-1">{appUrl}/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="yourname"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="My Links"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  rows={3}
                  placeholder="Creator, educator, builder."
                />
              </div>
            </div>
          </div>

          {/* Bio Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Links on Bio Page</h3>
            {bioLinks.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No bio links yet. When creating a Smart Link, check &quot;Show on Bio Page&quot; to add it here.
              </p>
            ) : (
              <div className="space-y-2">
                {bioLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
                      <p className="text-xs text-gray-400 truncate">{link.destination_url}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ maxHeight: '600px' }}>
              <div className="bg-gradient-to-b from-brand-600 to-brand-800 p-8 text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl text-white font-bold">
                    {(title || 'You')[0]?.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">{title || 'My Links'}</h2>
                {description && <p className="text-brand-100 mt-1 text-sm">{description}</p>}
              </div>
              <div className="p-4 space-y-3">
                {bioLinks.map((link) => (
                  <div
                    key={link.id}
                    className="border border-gray-200 rounded-lg p-3 text-center text-sm font-medium text-gray-900 hover:bg-gray-50 cursor-pointer"
                  >
                    {link.title}
                  </div>
                ))}
                {bioLinks.length === 0 && (
                  <div className="text-center text-gray-300 py-8 text-sm">
                    Your links will appear here
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
