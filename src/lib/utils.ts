import { customAlphabet } from 'nanoid';

// Generate short codes for links (URL-safe, no ambiguous chars)
const nanoid = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 7);

export function generateShortCode(): string {
  return nanoid();
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

// Parse UTM params from URL
export function parseUTMParams(url: string) {
  try {
    const params = new URL(url).searchParams;
    return {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      utm_content: params.get('utm_content') || null,
      utm_term: params.get('utm_term') || null,
    };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null };
  }
}

// Format number for display (1234 → 1.2K)
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

// Time ago string
export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

// Validate URL
export function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// URL-safe slug: lowercase letters, numbers, hyphens only; 3–64 chars; no leading/trailing hyphen
const URL_SAFE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 64;
const RESERVED_SLUGS = new Set([
  'api', 'auth', 'dashboard', 'r', 'admin', 'login', 'signup', 'favicon.ico', 'robots.txt',
]);

export function isUrlSafeSlug(slug: string): boolean {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length < MIN_SLUG_LENGTH || trimmed.length > MAX_SLUG_LENGTH) return false;
  if (!URL_SAFE_SLUG_REGEX.test(trimmed)) return false;
  if (RESERVED_SLUGS.has(trimmed)) return false;
  return true;
}

/** Returns a user-friendly error message or null if valid. */
export function getSlugValidationError(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null; // empty = use auto-generate
  const lower = trimmed.toLowerCase();
  if (trimmed !== lower) return 'Use only lowercase letters, numbers, and hyphens.';
  if (trimmed.length < MIN_SLUG_LENGTH) return `Short code must be at least ${MIN_SLUG_LENGTH} characters.`;
  if (trimmed.length > MAX_SLUG_LENGTH) return `Short code must be ${MAX_SLUG_LENGTH} characters or less.`;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(trimmed)) {
    return 'Use only lowercase letters, numbers, and hyphens. No spaces or special characters.';
  }
  if (RESERVED_SLUGS.has(trimmed)) return 'This short code is reserved.';
  return null;
}
