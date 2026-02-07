-- ============================================
-- CREATOR DATA PLATFORM - DATABASE SCHEMA
-- ============================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → Your Project → SQL Editor → New Query
-- Paste this entire file and click "Run"
-- ============================================

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio_slug TEXT UNIQUE,              -- their unique bio page URL slug (e.g., "johndoe")
  bio_title TEXT DEFAULT 'My Links',
  bio_description TEXT,
  bio_theme JSONB DEFAULT '{"bg":"#ffffff","text":"#000000","accent":"#3361FF","style":"minimal"}'::jsonb,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'business', 'agency')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SMART LINKS
-- ============================================
CREATE TABLE public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  short_code TEXT NOT NULL UNIQUE,     -- the short code (e.g., "abc123")
  destination_url TEXT NOT NULL,       -- where the click redirects to
  title TEXT,                          -- friendly name for dashboard
  is_bio_link BOOLEAN DEFAULT false,   -- whether this appears on their bio page
  bio_order INTEGER DEFAULT 0,         -- sort order on bio page
  bio_icon TEXT,                       -- optional icon name (lucide icon)
  tags TEXT[] DEFAULT '{}',            -- for organizing/filtering
  is_active BOOLEAN DEFAULT true,
  -- A/B testing
  ab_enabled BOOLEAN DEFAULT false,
  ab_destination_url TEXT,             -- alternate destination
  ab_split INTEGER DEFAULT 50,         -- percentage to destination A
  -- Metadata
  total_clicks INTEGER DEFAULT 0,      -- denormalized counter for fast reads
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_links_user_id ON public.links(user_id);
CREATE INDEX idx_links_short_code ON public.links(short_code);
CREATE INDEX idx_links_bio ON public.links(user_id, is_bio_link, bio_order) WHERE is_bio_link = true;

-- ============================================
-- 3. CLICK EVENTS (the core analytics table)
-- ============================================
CREATE TABLE public.click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Visitor Identity
  visitor_id TEXT,                     -- our generated anonymous visitor ID
  fingerprint_hash TEXT,               -- browser fingerprint hash
  
  -- Network
  ip_address INET,
  country TEXT,
  region TEXT,
  city TEXT,
  isp TEXT,
  
  -- Device
  device_type TEXT,                    -- desktop, mobile, tablet
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  screen_resolution TEXT,
  language TEXT,
  timezone TEXT,
  
  -- Referral
  referrer_url TEXT,
  referrer_domain TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  
  -- A/B
  ab_variant TEXT CHECK (ab_variant IN ('A', 'B')),
  
  -- Timestamp
  clicked_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clicks_link_id ON public.click_events(link_id);
CREATE INDEX idx_clicks_user_id ON public.click_events(user_id);
CREATE INDEX idx_clicks_visitor ON public.click_events(visitor_id);
CREATE INDEX idx_clicks_fingerprint ON public.click_events(fingerprint_hash);
CREATE INDEX idx_clicks_time ON public.click_events(clicked_at DESC);
CREATE INDEX idx_clicks_country ON public.click_events(country);

-- ============================================
-- 4. VISITOR PROFILES (identity resolution)
-- ============================================
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,             -- our anonymous visitor ID
  
  -- Known identity (populated when resolved)
  email TEXT,
  full_name TEXT,
  company TEXT,
  job_title TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  
  -- Fingerprints (a visitor may have multiple)
  fingerprint_hashes TEXT[] DEFAULT '{}',
  ip_addresses INET[] DEFAULT '{}',
  
  -- Scoring
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  engagement_score INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  
  -- Inferred data
  inferred_location TEXT,
  inferred_interests TEXT[] DEFAULT '{}',
  device_types TEXT[] DEFAULT '{}',
  
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, visitor_id)
);

CREATE INDEX idx_visitors_user ON public.visitors(user_id);
CREATE INDEX idx_visitors_visitor_id ON public.visitors(visitor_id);
CREATE INDEX idx_visitors_fingerprint ON public.visitors USING GIN(fingerprint_hashes);
CREATE INDEX idx_visitors_email ON public.visitors(email) WHERE email IS NOT NULL;

-- ============================================
-- 5. ANALYTICS AGGREGATES (for fast dashboard loads)
-- ============================================
CREATE TABLE public.analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  link_id UUID REFERENCES public.links(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  total_clicks INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  
  -- Top breakdowns (stored as JSONB for flexibility)
  countries JSONB DEFAULT '{}'::jsonb,     -- {"US": 45, "UK": 12, ...}
  devices JSONB DEFAULT '{}'::jsonb,       -- {"desktop": 30, "mobile": 50, ...}
  referrers JSONB DEFAULT '{}'::jsonb,     -- {"youtube.com": 20, "direct": 15, ...}
  browsers JSONB DEFAULT '{}'::jsonb,      -- {"Chrome": 40, "Safari": 25, ...}
  hours JSONB DEFAULT '{}'::jsonb,         -- {"0": 2, "1": 1, ..., "23": 5}
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, link_id, date)
);

CREATE INDEX idx_analytics_user_date ON public.analytics_daily(user_id, date DESC);
CREATE INDEX idx_analytics_link_date ON public.analytics_daily(link_id, date DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Links: users can CRUD their own links
CREATE POLICY "Users can view own links" ON public.links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create links" ON public.links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own links" ON public.links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own links" ON public.links
  FOR DELETE USING (auth.uid() = user_id);

-- Click events: users can view their own
CREATE POLICY "Users can view own clicks" ON public.click_events
  FOR SELECT USING (auth.uid() = user_id);

-- Visitors: users can view their own
CREATE POLICY "Users can view own visitors" ON public.visitors
  FOR SELECT USING (auth.uid() = user_id);

-- Analytics: users can view their own
CREATE POLICY "Users can view own analytics" ON public.analytics_daily
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 7. SERVICE ROLE POLICIES (for API routes)
-- ============================================
-- The tracking API uses the service role key to insert click events
-- (since anonymous visitors don't have auth tokens)
-- These are handled by the service role bypassing RLS

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Increment link click counter (called by tracking API)
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.links SET total_clicks = total_clicks + 1, updated_at = now()
  WHERE id = link_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert daily analytics (called by tracking API)
CREATE OR REPLACE FUNCTION public.upsert_daily_analytics(
  p_user_id UUID,
  p_link_id UUID,
  p_date DATE,
  p_country TEXT,
  p_device TEXT,
  p_referrer TEXT,
  p_browser TEXT,
  p_hour INTEGER
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.analytics_daily (user_id, link_id, date, total_clicks, unique_visitors, countries, devices, referrers, browsers, hours)
  VALUES (
    p_user_id, p_link_id, p_date, 1, 1,
    jsonb_build_object(COALESCE(p_country, 'Unknown'), 1),
    jsonb_build_object(COALESCE(p_device, 'Unknown'), 1),
    jsonb_build_object(COALESCE(p_referrer, 'Direct'), 1),
    jsonb_build_object(COALESCE(p_browser, 'Unknown'), 1),
    jsonb_build_object(p_hour::text, 1)
  )
  ON CONFLICT (user_id, link_id, date) DO UPDATE SET
    total_clicks = analytics_daily.total_clicks + 1,
    countries = analytics_daily.countries || jsonb_build_object(
      COALESCE(p_country, 'Unknown'),
      COALESCE((analytics_daily.countries->>COALESCE(p_country, 'Unknown'))::int, 0) + 1
    ),
    devices = analytics_daily.devices || jsonb_build_object(
      COALESCE(p_device, 'Unknown'),
      COALESCE((analytics_daily.devices->>COALESCE(p_device, 'Unknown'))::int, 0) + 1
    ),
    referrers = analytics_daily.referrers || jsonb_build_object(
      COALESCE(p_referrer, 'Direct'),
      COALESCE((analytics_daily.referrers->>COALESCE(p_referrer, 'Direct'))::int, 0) + 1
    ),
    browsers = analytics_daily.browsers || jsonb_build_object(
      COALESCE(p_browser, 'Unknown'),
      COALESCE((analytics_daily.browsers->>COALESCE(p_browser, 'Unknown'))::int, 0) + 1
    ),
    hours = analytics_daily.hours || jsonb_build_object(
      p_hour::text,
      COALESCE((analytics_daily.hours->>p_hour::text)::int, 0) + 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Your database is ready.
-- ============================================
