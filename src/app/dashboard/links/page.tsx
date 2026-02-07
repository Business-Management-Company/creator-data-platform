'use client';

import { useEffect, useState } from 'react';
import { Plus, Copy, ExternalLink, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatNumber, timeAgo, getSlugValidationError } from '@/lib/utils';

interface Link {
  id: string;
  short_code: string;
  destination_url: string;
  title: string;
  is_bio_link: boolean;
  is_active: boolean;
  total_clicks: number;
  created_at: string;
  tags: string[];
}

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [slugAvailability, setSlugAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [isBioLink, setIsBioLink] = useState(false);
  const [creating, setCreating] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    const res = await fetch('/api/links');
    const data = await res.json();
    setLinks(data);
    setLoading(false);
  }

  const slugError = customSlug ? getSlugValidationError(customSlug) : null;

  async function checkSlugAvailability() {
    const trimmed = customSlug.trim().toLowerCase();
    if (!trimmed) {
      setSlugAvailability('idle');
      return;
    }
    if (getSlugValidationError(trimmed)) {
      setSlugAvailability('invalid');
      return;
    }
    setSlugAvailability('checking');
    try {
      const res = await fetch(`/api/links/check-slug?slug=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setSlugAvailability(data.available ? 'available' : 'taken');
    } catch {
      setSlugAvailability('idle');
    }
  }

  async function createLink() {
    if (!newUrl) return;
    if (customSlug.trim() && slugError) return;
    setCreating(true);

    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination_url: newUrl,
        title: newTitle || newUrl,
        is_bio_link: isBioLink,
        ...(customSlug.trim() && { short_code: customSlug.trim().toLowerCase() }),
      }),
    });

    if (res.ok) {
      toast.success('Link created!');
      setNewUrl('');
      setNewTitle('');
      setCustomSlug('');
      setSlugAvailability('idle');
      setIsBioLink(false);
      setShowCreate(false);
      loadLinks();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Failed to create link');
    }
    setCreating(false);
  }

  async function deleteLink(id: string) {
    if (!confirm('Delete this link? Click data will also be removed.')) return;
    const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Link deleted');
      loadLinks();
    }
  }

  async function toggleActive(id: string, currentState: boolean) {
    const res = await fetch(`/api/links/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentState }),
    });
    if (res.ok) loadLinks();
  }

  function copyLink(shortCode: string) {
    navigator.clipboard.writeText(`${appUrl}/r/${shortCode}`);
    toast.success('Link copied!');
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Links</h1>
          <p className="text-gray-500 mt-1">Create and manage your tracked links.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Link
        </button>
      </div>

      {/* Create Link Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Smart Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="https://your-site.com/landing-page"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom short code (optional)</label>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => {
                    setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    setSlugAvailability('idle');
                  }}
                  onBlur={checkSlugAvailability}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none ${
                    slugError || slugAvailability === 'taken'
                      ? 'border-red-500 focus:border-red-500'
                      : slugAvailability === 'available'
                        ? 'border-green-500 focus:border-green-500'
                        : 'border-gray-300 focus:border-brand-500'
                  }`}
                  placeholder="my-course (leave blank to auto-generate)"
                  maxLength={64}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Letters, numbers, hyphens only. 3–64 characters. Your link: {appUrl}/r/{customSlug || '…'}
                </p>
                {slugError && <p className="mt-1 text-xs text-red-600">{slugError}</p>}
                {!slugError && slugAvailability === 'available' && <p className="mt-1 text-xs text-green-600">Available</p>}
                {!slugError && slugAvailability === 'taken' && <p className="mt-1 text-xs text-red-600">This short code is already taken.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="My YouTube Course Link"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBioLink}
                  onChange={(e) => setIsBioLink(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Show on my Bio Page
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCustomSlug('');
                  setSlugAvailability('idle');
                }}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createLink}
                disabled={creating || !newUrl || (customSlug.trim() && (!!slugError || slugAvailability === 'taken'))}
                className="flex-1 bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-48 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-72 bg-gray-100 rounded" />
            </div>
          ))
        ) : links.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Plus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No links yet. Create your first Smart Link!</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              Create Link
            </button>
          </div>
        ) : (
          links.map((link) => (
            <div
              key={link.id}
              className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm ${
                !link.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{link.title}</h3>
                    {link.is_bio_link && (
                      <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">Bio</span>
                    )}
                    {!link.is_active && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                      {appUrl}/r/{link.short_code}
                    </code>
                    <button onClick={() => copyLink(link.short_code)} className="text-gray-400 hover:text-gray-600">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 truncate">→ {link.destination_url}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(link.total_clicks)}</div>
                    <div className="text-xs text-gray-400">clicks</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(link.id, link.is_active)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title={link.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {link.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <a
                      href={link.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Created {timeAgo(link.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
