'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

function getFingerprinter() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

export async function getVisitorData() {
  try {
    const fp = await getFingerprinter();
    const result = await fp.get();

    return {
      fingerprint_hash: result.visitorId,
      // Additional signals for identity stitching
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      // Confidence from FingerprintJS
      confidence: result.confidence.score,
    };
  } catch (error) {
    console.error('Fingerprint error:', error);
    return null;
  }
}

// Send tracking data to our API
export async function trackClick(linkCode: string, extraData?: Record<string, any>) {
  try {
    const visitorData = await getVisitorData();

    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        link_code: linkCode,
        fingerprint: visitorData,
        referrer: document.referrer,
        page_url: window.location.href,
        ...extraData,
      }),
      // Use keepalive so the request completes even if the page navigates away
      keepalive: true,
    });
  } catch (error) {
    // Silently fail - don't block the user's experience
    console.error('Track error:', error);
  }
}
