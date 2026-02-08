'use client';

import { useEffect, useState } from 'react';
import { getVisitorData } from '@/lib/fingerprint';
import { Instagram, Youtube, Music2, Twitter, Linkedin, Facebook, Tv, MessageCircle, Music, Globe } from 'lucide-react';

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  twitch: Tv,
  discord: MessageCircle,
  spotify: Music,
  apple_music: Music,
  website: Globe,
};

interface BioLink {
  id: string;
  title: string;
  shortCode: string;
  destinationUrl: string;
  icon: string | null;
  thumbnailUrl: string | null;
  priority: boolean;
}

interface BioPageProps {
  profile: {
    title: string;
    description: string;
    displayName: string;
    bioText: string;
    avatarUrl: string;
    theme: { bg: string; text: string; accent: string; style: string };
    pageSettings?: {
      background_type?: string;
      background_value?: string;
      background_value_2?: string;
      background_image?: string;
      text_color?: string;
      accent_color?: string;
      font_family?: string;
      button_style?: string;
      show_avatar?: boolean;
      show_social_icons?: boolean;
      email_capture?: boolean;
    };
    socialLinks: Record<string, string>;
  };
  links: BioLink[];
  slug: string;
}

export default function BioPageClient({ profile, links, slug }: BioPageProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const settings = profile.pageSettings || {};
  const textColor = settings.text_color || profile.theme?.text || '#111827';
  const accentColor = settings.accent_color || profile.theme?.accent || '#3361FF';
  const showAvatar = settings.show_avatar !== false;
  const showSocialIcons = settings.show_social_icons !== false;
  const emailCapture = settings.email_capture;

  const bgStyle =
    settings.background_type === 'gradient'
      ? {
          background: `linear-gradient(180deg, ${settings.background_value || '#fff'}, ${settings.background_value_2 || '#fff'})`,
        }
      : settings.background_type === 'image' && settings.background_image
        ? {
          backgroundImage: `url(${settings.background_image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
        : { backgroundColor: settings.background_value || profile.theme?.bg || '#ffffff' };

  const buttonClass =
    settings.button_style === 'pill'
      ? 'rounded-full'
      : settings.button_style === 'square'
        ? 'rounded-none'
        : settings.button_style === 'outline'
          ? 'rounded-xl border-2 bg-transparent'
          : 'rounded-xl';

  const socialEntries = Object.entries(profile.socialLinks || {}).filter(([, url]) => url?.trim());

  useEffect(() => {
    async function trackVisit() {
      try {
        const visitorData = await getVisitorData();
        if (visitorData?.fingerprint_hash) {
          // Silent tracking
        }
      } catch {
        // Silent fail
      }
    }
    trackVisit();
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || subscribed) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok || data.message === 'Already subscribed!') {
        setSubscribed(true);
        setEmail('');
      } else {
        alert(data.error || 'Something went wrong');
      }
    } catch {
      alert('Failed to subscribe');
    }
    setSubmitting(false);
  }

  function handleLinkClick(link: BioLink) {
    window.location.href = `${appUrl}/r/${link.shortCode}`;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-8 pb-16 px-4"
      style={bgStyle}
    >
      <div className="w-full max-w-md animate-fade-in">
        {/* Profile Header */}
        <div className="text-center mb-8">
          {showAvatar && (
            <div
              className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden border-2"
              style={{ borderColor: accentColor }}
            >
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span
                  className="text-3xl font-bold"
                  style={{ color: accentColor }}
                >
                  {(profile.displayName || profile.title || 'You')[0]?.toUpperCase()}
                </span>
              )}
            </div>
          )}
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: textColor, fontFamily: settings.font_family || 'Inter, sans-serif' }}
          >
            {profile.displayName || profile.title || 'My Links'}
          </h1>
          {(profile.bioText || profile.description) && (
            <p
              className="text-sm opacity-90 whitespace-pre-wrap"
              style={{ color: textColor }}
            >
              {profile.bioText || profile.description}
            </p>
          )}
          {showSocialIcons && socialEntries.length > 0 && (
            <div className="flex justify-center gap-4 mt-4">
              {socialEntries.map(([platformId, url]) => {
                const Icon = SOCIAL_ICONS[platformId];
                if (!Icon || !url?.trim()) return null;
                return (
                  <a
                    key={platformId}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    aria-label={platformId}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link, i) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link)}
              className={`w-full p-4 text-left font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 ${buttonClass}`}
              style={{
                backgroundColor: settings.button_style === 'outline' ? 'transparent' : accentColor,
                borderColor: accentColor,
                color: settings.button_style === 'outline' ? textColor : '#fff',
                animationDelay: `${i * 50}ms`,
              }}
            >
              {link.thumbnailUrl && (
                <img
                  src={link.thumbnailUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <span className="flex-1 truncate">{link.title}</span>
              {link.priority && (
                <span className="flex-shrink-0 text-amber-300" aria-hidden>
                  ★
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Email Capture */}
        {emailCapture && (
          <div className="mt-8 p-4 rounded-xl" style={{ borderColor: accentColor, borderWidth: 2 }}>
            {subscribed ? (
              <p className="text-center text-sm" style={{ color: textColor }}>
                Thanks for subscribing!
              </p>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: textColor }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {submitting ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 opacity-50">
          <a
            href="/"
            className="text-xs hover:opacity-70 transition-opacity"
            style={{ color: textColor }}
          >
            Powered by CreatorPixel
          </a>
        </div>
      </div>
    </div>
  );
}
