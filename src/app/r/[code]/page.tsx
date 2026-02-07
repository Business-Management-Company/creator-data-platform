'use client';

import { useEffect, useState } from 'react';
import { getVisitorData } from '@/lib/fingerprint';
import { Eye } from 'lucide-react';

// This page handles smart link redirects.
// URL pattern: /r/[shortcode]
// Flow: User clicks link → lands here → we fingerprint + track → redirect to destination

export default function RedirectPage({ params }: { params: { code: string } }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    async function handleRedirect() {
      try {
        // 1. Get browser fingerprint
        const visitorData = await getVisitorData();

        // 2. Parse UTM params from current URL
        const urlParams = new URLSearchParams(window.location.search);

        // 3. Send tracking data to our API
        const response = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            link_code: params.code,
            fingerprint: visitorData,
            referrer: document.referrer,
            utm_source: urlParams.get('utm_source'),
            utm_medium: urlParams.get('utm_medium'),
            utm_campaign: urlParams.get('utm_campaign'),
            utm_content: urlParams.get('utm_content'),
            utm_term: urlParams.get('utm_term'),
          }),
        });

        if (!response.ok) {
          setError(true);
          return;
        }

        const data = await response.json();

        // 4. Redirect to destination
        if (data.destination) {
          window.location.replace(data.destination);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Redirect error:', err);
        setError(true);
      }
    }

    handleRedirect();
  }, [params.code]);

  // Show a brief loading state (most users see this for <500ms)
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-lg">This link is no longer active.</p>
          <a href="/" className="text-brand-600 mt-2 inline-block">← Go home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Eye className="w-6 h-6 text-white" />
        </div>
        <p className="text-gray-400 text-sm">Redirecting...</p>
      </div>
    </div>
  );
}
