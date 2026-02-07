'use client';

import { useEffect } from 'react';
import { getVisitorData } from '@/lib/fingerprint';

interface BioLink {
  id: string;
  title: string;
  shortCode: string;
  destinationUrl: string;
  icon: string | null;
}

interface BioPageProps {
  profile: {
    title: string;
    description: string;
    theme: { bg: string; text: string; accent: string; style: string };
    avatarUrl: string;
  };
  links: BioLink[];
}

export default function BioPageClient({ profile, links }: BioPageProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  // Track bio page visit on load
  useEffect(() => {
    async function trackVisit() {
      try {
        const visitorData = await getVisitorData();
        // We could add a separate "page_view" event type in the future
        // For now, the bio page itself acts as a data collection point
        console.log('Visitor fingerprint captured:', visitorData?.fingerprint_hash?.slice(0, 8));
      } catch (e) {
        // Silent fail
      }
    }
    trackVisit();
  }, []);

  function handleLinkClick(link: BioLink) {
    // Navigate through the smart link redirect to capture the click
    window.location.href = `${appUrl}/r/${link.shortCode}`;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: profile.theme.bg }}
    >
      <div className="w-full max-w-md">
        {/* Profile Header */}
        <div className="text-center mb-8">
          <div
            className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
            style={{ backgroundColor: profile.theme.accent }}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.title[0]?.toUpperCase() || '?'
            )}
          </div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: profile.theme.text }}
          >
            {profile.title}
          </h1>
          {profile.description && (
            <p className="text-sm opacity-70" style={{ color: profile.theme.text }}>
              {profile.description}
            </p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link)}
              className="w-full p-4 rounded-xl text-center font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform border-2"
              style={{
                backgroundColor: 'transparent',
                borderColor: profile.theme.accent,
                color: profile.theme.text,
              }}
            >
              {link.title}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="text-xs opacity-40 hover:opacity-70"
            style={{ color: profile.theme.text }}
          >
            Powered by CreatorPixel
          </a>
        </div>
      </div>
    </div>
  );
}
