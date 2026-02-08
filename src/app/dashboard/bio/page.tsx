'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  ExternalLink,
  Save,
  Upload,
  Trash2,
  GripVertical,
  Star,
  Image,
  Mail,
  Smartphone,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { THEME_PRESETS, SOCIAL_PLATFORMS } from '@/lib/bio-themes';

interface Profile {
  id: string;
  bio_slug: string | null;
  bio_title: string;
  bio_description: string | null;
  bio_theme: { bg: string; text: string; accent: string; style: string } | null;
  theme?: string;
  bio_text?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  social_links?: Record<string, string>;
  page_settings?: {
    background_type?: string;
    background_value?: string;
    background_value_2?: string;
    text_color?: string;
    accent_color?: string;
    font_family?: string;
    button_style?: string;
    show_avatar?: boolean;
    show_social_icons?: boolean;
    background_image?: string;
    email_capture?: boolean;
    custom_css?: string;
  };
}

interface BioLink {
  id: string;
  title: string;
  destination_url: string;
  short_code: string;
  bio_order: number;
  link_order: number | null;
  is_active: boolean;
  priority?: boolean;
  thumbnail_url?: string | null;
  icon?: string | null;
  schedule_start?: string | null;
  schedule_end?: string | null;
}

function SortableLink({
  link,
  onTogglePriority,
  onThumbnailChange,
  onScheduleChange,
}: {
  link: BioLink;
  onTogglePriority: (id: string) => void;
  onThumbnailChange: (id: string, url: string) => void;
  onScheduleChange: (id: string, start: string | null, end: string | null) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [thumbUrl, setThumbUrl] = useState(link.thumbnail_url || '');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-gray-50 rounded-lg ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab touch-none">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
          <p className="text-xs text-gray-400 truncate">{link.destination_url}</p>
        </div>
        <button
          onClick={() => onTogglePriority(link.id)}
          className={`p-1 rounded ${link.priority ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
          title={link.priority ? 'Unfeature' : 'Feature'}
        >
          <Star className={`w-4 h-4 ${link.priority ? 'fill-current' : ''}`} />
        </button>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Thumbnail & schedule"
        >
          <Image className="w-4 h-4" />
        </button>
      </div>
      {showOptions && (
        <div className="pl-9 mt-3 space-y-3 pt-3 border-t border-gray-200">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Thumbnail URL</label>
            <input
              type="url"
              value={thumbUrl}
              onChange={(e) => setThumbUrl(e.target.value)}
              onBlur={() => onThumbnailChange(link.id, thumbUrl.trim())}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Schedule (optional)
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="datetime-local"
                value={link.schedule_start ? link.schedule_start.slice(0, 16) : ''}
                onChange={(e) =>
                  onScheduleChange(link.id, e.target.value ? new Date(e.target.value).toISOString() : null, link.schedule_end || null)
                }
                placeholder="Start"
                className="w-full border border-gray-300 rounded px-2 py-1"
              />
              <input
                type="datetime-local"
                value={link.schedule_end ? link.schedule_end.slice(0, 16) : ''}
                onChange={(e) =>
                  onScheduleChange(link.id, link.schedule_start || null, e.target.value ? new Date(e.target.value).toISOString() : null)
                }
                placeholder="End"
                className="w-full border border-gray-300 rounded px-2 py-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BioEditorPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioLinks, setBioLinks] = useState<BioLink[]>([]);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bioText, setBioText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [theme, setTheme] = useState('minimal_white');
  const [pageSettings, setPageSettings] = useState<Profile['page_settings']>({
    background_type: 'solid',
    background_value: '#ffffff',
    background_value_2: '#ffffff',
    text_color: '#111827',
    accent_color: '#3361FF',
    font_family: 'Inter',
    button_style: 'rounded',
    show_avatar: true,
    show_social_icons: true,
    email_capture: false,
  });
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
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
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setSlug(profileData.bio_slug || '');
      setTitle(profileData.bio_title || '');
      setDescription(profileData.bio_description || '');
      setDisplayName(profileData.display_name || profileData.full_name || '');
      setBioText(profileData.bio_text || profileData.bio_description || '');
      setAvatarUrl(profileData.avatar_url || '');
      setTheme(profileData.theme || 'minimal_white');
      setPageSettings({
        ...{
          background_type: 'solid',
          background_value: '#ffffff',
          background_value_2: '#ffffff',
          text_color: '#111827',
          accent_color: '#3361FF',
          font_family: 'Inter',
          button_style: 'rounded',
          show_avatar: true,
          show_social_icons: true,
          email_capture: false,
        },
        ...(profileData.page_settings || {}),
      });
      setSocialLinks((profileData.social_links as Record<string, string>) || {});
    }

    const { data: links } = await supabase
      .from('links')
      .select('id, title, destination_url, short_code, bio_order, link_order, is_active, priority, thumbnail_url, icon, schedule_start, schedule_end')
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

    const updates: Record<string, unknown> = {
      bio_slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      bio_title: title,
      bio_description: description,
      display_name: displayName,
      bio_text: bioText,
      avatar_url: avatarUrl || null,
      theme,
      social_links: socialLinks,
      page_settings: pageSettings,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || 'Failed to save');
    } else {
      toast.success('Bio page saved!');
    }
    setSaving(false);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = bioLinks.findIndex((l) => l.id === active.id);
    const newIndex = bioLinks.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(bioLinks, oldIndex, newIndex);
    setBioLinks(newOrder);

    const orderedIds = newOrder.map((l) => l.id);
    const res = await fetch('/api/links/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) toast.error('Failed to reorder');
  }

  async function updateLink(id: string, updates: Partial<BioLink>) {
    const res = await fetch(`/api/links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setBioLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    } else {
      toast.error('Failed to update link');
    }
  }

  function applyTheme(presetId: keyof typeof THEME_PRESETS) {
    const preset = THEME_PRESETS[presetId];
    if (!preset) return;
    setTheme(presetId);
    setPageSettings({ ...pageSettings, ...preset.page_settings });
  }

  function copyBioUrl() {
    if (slug) {
      navigator.clipboard.writeText(`${appUrl}/${slug}`);
      toast.success('Bio page URL copied!');
    }
  }

  // Live preview styles
  const previewBg =
    pageSettings?.background_type === 'gradient'
      ? `linear-gradient(180deg, ${pageSettings.background_value || '#fff'}, ${pageSettings.background_value_2 || '#fff'})`
      : pageSettings?.background_type === 'image' && pageSettings.background_image
        ? `url(${pageSettings.background_image})`
        : pageSettings?.background_value || '#ffffff';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
          <p className="text-gray-500 mt-1">Your link-in-bio page with themes, social links & more.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Editor */}
        <div className="xl:col-span-2 space-y-6">
          {/* Page Settings */}
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
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="My Links"
                />
              </div>
            </div>
          </div>

          {/* Theme Picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Theme</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(THEME_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => applyTheme(id as keyof typeof THEME_PRESETS)}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    theme === id ? 'border-brand-600 ring-2 ring-brand-200' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="h-12 rounded-lg mb-2"
                    style={{
                      background:
                        preset.page_settings.background_type === 'gradient'
                          ? `linear-gradient(180deg, ${preset.page_settings.background_value}, ${preset.page_settings.background_value_2})`
                          : preset.page_settings.background_value,
                    }}
                  />
                  <p className="text-xs font-medium text-gray-700">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Profile Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="Paste image URL or base64"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">URL or data:image/... base64</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio Text (emoji supported)</label>
                <textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Creator, educator, builder ✨"
                />
              </div>
            </div>
          </div>

          {/* Social Icons */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Social Links</h3>
            <div className="space-y-3">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">{platform.name}</span>
                  <input
                    type="url"
                    value={socialLinks[platform.id] || ''}
                    onChange={(e) => setSocialLinks((s) => ({ ...s, [platform.id]: e.target.value }))}
                    placeholder={platform.urlPrefix}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {(socialLinks[platform.id] || '').trim() && (
                    <button
                      onClick={() => setSocialLinks((s) => ({ ...s, [platform.id]: '' }))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Link Customization */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Links (drag to reorder)</h3>
            {bioLinks.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No bio links yet. When creating a Smart Link, check &quot;Show on Bio Page&quot; to add it here.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={bioLinks.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {bioLinks.map((link) => (
                      <SortableLink
                        key={link.id}
                        link={link}
                        onTogglePriority={(id) => updateLink(id, { priority: !bioLinks.find((l) => l.id === id)?.priority })}
                        onThumbnailChange={(id, url) => updateLink(id, { thumbnail_url: url || null })}
                        onScheduleChange={(id, start, end) => updateLink(id, { schedule_start: start, schedule_end: end })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Background Options */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Background</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={pageSettings?.background_type || 'solid'}
                  onChange={(e) => setPageSettings((s) => ({ ...s, background_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="solid">Solid color</option>
                  <option value="gradient">Gradient (2 colors)</option>
                  <option value="image">Background image (URL)</option>
                </select>
              </div>
              {(pageSettings?.background_type || 'solid') === 'solid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={pageSettings?.background_value || '#ffffff'}
                    onChange={(e) => setPageSettings((s) => ({ ...s, background_value: e.target.value }))}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              )}
              {(pageSettings?.background_type || 'solid') === 'gradient' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color 1</label>
                    <input
                      type="color"
                      value={pageSettings?.background_value || '#3b82f6'}
                      onChange={(e) => setPageSettings((s) => ({ ...s, background_value: e.target.value }))}
                      className="w-full h-10 rounded cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color 2</label>
                    <input
                      type="color"
                      value={pageSettings?.background_value_2 || '#1d4ed8'}
                      onChange={(e) => setPageSettings((s) => ({ ...s, background_value_2: e.target.value }))}
                      className="w-full h-10 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
              {(pageSettings?.background_type || 'solid') === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={(pageSettings as { background_image?: string })?.background_image || ''}
                    onChange={(e) =>
                      setPageSettings((s) => ({ ...s, background_image: e.target.value } as Profile['page_settings']))
                    }
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Button Shape</label>
                <select
                  value={pageSettings?.button_style || 'rounded'}
                  onChange={(e) => setPageSettings((s) => ({ ...s, button_style: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="rounded">Rounded</option>
                  <option value="pill">Pill</option>
                  <option value="square">Square</option>
                  <option value="outline">Outline</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email Capture */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Capture
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pageSettings?.email_capture || false}
                onChange={(e) => setPageSettings((s) => ({ ...s, email_capture: e.target.checked }))}
                className="rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700">Show email signup form on bio page</span>
            </label>
          </div>
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-1">
          <div className="sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Live Preview
            </h3>
            <div className="relative">
              {/* Phone frame */}
              <div className="mx-auto w-[280px] rounded-[2.5rem] border-[12px] border-gray-800 bg-gray-900 p-2 shadow-2xl">
                <div className="h-[520px] overflow-y-auto rounded-[1.5rem] bg-white" style={{ background: previewBg }}>
                  <div className="p-6 text-center">
                    {pageSettings?.show_avatar !== false && (
                      <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden flex items-center justify-center bg-white/20">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold" style={{ color: pageSettings?.text_color || '#111' }}>
                            {(displayName || title || 'You')[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                    <h2
                      className="text-lg font-bold"
                      style={{ color: pageSettings?.text_color || '#111', fontFamily: pageSettings?.font_family || 'Inter' }}
                    >
                      {displayName || title || 'My Links'}
                    </h2>
                    {bioText && (
                      <p
                        className="text-xs mt-1 opacity-90"
                        style={{ color: pageSettings?.text_color || '#111' }}
                      >
                        {bioText}
                      </p>
                    )}
                    {pageSettings?.show_social_icons !== false &&
                      Object.values(socialLinks).some((v) => v?.trim()) && (
                        <div className="flex justify-center gap-3 mt-3">
                          {Object.entries(socialLinks)
                            .filter(([, url]) => url?.trim())
                            .slice(0, 5)
                            .map(([id]) => (
                              <div
                                key={id}
                                className="w-8 h-8 rounded-full bg-white/20"
                                style={{ backgroundColor: pageSettings?.accent_color || '#3361FF' }}
                              />
                            ))}
                        </div>
                      )}
                  </div>
                  <div className="px-4 pb-6 space-y-2">
                    {bioLinks.slice(0, 5).map((link) => (
                      <div
                        key={link.id}
                        className={`flex items-center gap-2 p-2 text-center text-sm font-medium ${
                          pageSettings?.button_style === 'pill'
                            ? 'rounded-full'
                            : pageSettings?.button_style === 'square'
                              ? 'rounded-none'
                              : pageSettings?.button_style === 'outline'
                                ? 'rounded-lg border-2 bg-transparent'
                                : 'rounded-lg'
                        }`}
                        style={{
                          backgroundColor:
                            pageSettings?.button_style === 'outline' ? 'transparent' : pageSettings?.accent_color || '#3361FF',
                          borderColor: pageSettings?.accent_color || '#3361FF',
                          color: pageSettings?.button_style === 'outline' ? (pageSettings?.text_color || '#111') : '#fff',
                        }}
                      >
                        {link.thumbnail_url && (
                          <img src={link.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                        )}
                        <span className="flex-1 truncate">{link.title}</span>
                        {link.priority && <Star className="w-3 h-3 flex-shrink-0 fill-current" />}
                      </div>
                    ))}
                    {pageSettings?.email_capture && (
                      <div className="p-2 rounded-lg border" style={{ borderColor: pageSettings?.accent_color }}>
                        <input
                          type="email"
                          placeholder="Your email"
                          className="w-full text-xs py-2 px-3 rounded bg-transparent"
                          style={{ color: pageSettings?.text_color }}
                          readOnly
                        />
                        <button
                          className="w-full mt-1 py-1.5 text-xs font-medium rounded text-white"
                          style={{ backgroundColor: pageSettings?.accent_color }}
                        >
                          Subscribe
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
