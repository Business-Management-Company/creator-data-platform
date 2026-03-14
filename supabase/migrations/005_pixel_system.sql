-- ============================================
-- CREATOR PIXEL — 3-LAYER IDENTITY RESOLUTION
-- ============================================
-- Migration 005: Full pixel tracking + identity system
-- Project: ptgidiolwzkrkajezvhs
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- Paste this entire file and click "Run"
-- ============================================


-- ============================================
-- 1. ADD pixel_id TO PROFILES
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pixel_id TEXT UNIQUE DEFAULT gen_random_uuid()::text;

UPDATE public.profiles SET pixel_id = gen_random_uuid()::text WHERE pixel_id IS NULL;

ALTER TABLE public.profiles ALTER COLUMN pixel_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN pixel_id SET DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_profiles_pixel_id ON public.profiles(pixel_id);


-- ============================================
-- 2. PIXEL INSTALLS
-- ============================================
CREATE TABLE IF NOT EXISTS public.pixel_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pixel_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  total_events INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

  UNIQUE(creator_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_pixel_installs_creator ON public.pixel_installs(creator_id);
CREATE INDEX IF NOT EXISTS idx_pixel_installs_pixel_id ON public.pixel_installs(pixel_id);


-- ============================================
-- 3. PAGE VIEW EVENTS (high-volume)
-- ============================================
CREATE TABLE IF NOT EXISTS public.page_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  pixel_id TEXT NOT NULL,

  page_url TEXT,
  page_title TEXT,
  referrer_url TEXT,
  referrer_domain TEXT,

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  country TEXT,
  region TEXT,
  city TEXT,
  ip_address INET,

  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  timezone TEXT,
  language TEXT,

  fingerprint_hash TEXT,
  session_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_creator ON public.page_view_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_pv_visitor ON public.page_view_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_pv_pixel ON public.page_view_events(pixel_id);
CREATE INDEX IF NOT EXISTS idx_pv_created ON public.page_view_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_fingerprint ON public.page_view_events(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_pv_session ON public.page_view_events(session_id);
CREATE INDEX IF NOT EXISTS idx_pv_ip ON public.page_view_events(ip_address);


-- ============================================
-- 4. IP ENRICHMENTS (PDL cache — Layer 2)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ip_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  company_name TEXT,
  company_domain TEXT,
  industry TEXT,
  employee_count TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  confidence REAL DEFAULT 0,
  raw_pdl_response JSONB,
  enriched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_ip_enrich_ip ON public.ip_enrichments(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_enrich_expires ON public.ip_enrichments(expires_at);


-- ============================================
-- 5. PERSON ENRICHMENTS (PDL cache — Layer 2+3)
-- ============================================
CREATE TABLE IF NOT EXISTS public.person_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  location_city TEXT,
  location_country TEXT,
  confidence REAL DEFAULT 0,
  raw_pdl_response JSONB,
  enriched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_enrich_email ON public.person_enrichments(email);


-- ============================================
-- 6. IDENTITY EVENTS (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.identity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'rb2b_match', 'pdl_ip_company', 'pdl_ip_person',
    'pdl_email', 'email_capture', 'fingerprint_merge'
  )),
  confidence_score INTEGER DEFAULT 0,
  identity_source TEXT,
  data_before JSONB,
  data_after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_events_creator ON public.identity_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_identity_events_visitor ON public.identity_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_identity_events_created ON public.identity_events(created_at DESC);


-- ============================================
-- 7. ADD IDENTITY COLUMNS TO VISITORS
-- ============================================
-- Drop old constraint if it exists (expand allowed values)
ALTER TABLE public.visitors
  DROP CONSTRAINT IF EXISTS visitors_identity_source_check;

ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS first_page_url TEXT,
  ADD COLUMN IF NOT EXISTS last_page_url TEXT,
  ADD COLUMN IF NOT EXISTS total_page_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_source TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0;

-- Add check constraint with expanded values
ALTER TABLE public.visitors
  ADD CONSTRAINT visitors_identity_source_check
  CHECK (identity_source IN ('rb2b', 'pdl_ip_company', 'pdl_ip_person', 'pdl_email', 'email_pdl', 'email', 'manual'));


-- ============================================
-- 8. ADD visitor_id + fingerprint TO SUBSCRIBERS
-- ============================================
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_subscribers_visitor ON public.subscribers(visitor_id);


-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.pixel_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_events ENABLE ROW LEVEL SECURITY;

-- pixel_installs: creators see their own
CREATE POLICY "Users can view own pixel installs" ON public.pixel_installs
  FOR SELECT USING (auth.uid() = creator_id);

-- page_view_events: creators see their own
CREATE POLICY "Users can view own page views" ON public.page_view_events
  FOR SELECT USING (auth.uid() = creator_id);

-- ip_enrichments: service role only (no user-facing policy needed)
-- The admin/service client bypasses RLS

-- person_enrichments: service role only
-- The admin/service client bypasses RLS

-- identity_events: creators see their own
CREATE POLICY "Users can view own identity events" ON public.identity_events
  FOR SELECT USING (auth.uid() = creator_id);


-- ============================================
-- 10. UPDATE handle_new_user FOR pixel_id
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, pixel_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    gen_random_uuid()::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Upsert pixel install domain
CREATE OR REPLACE FUNCTION public.upsert_pixel_install(
  p_creator_id UUID,
  p_pixel_id TEXT,
  p_domain TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.pixel_installs (creator_id, pixel_id, domain, total_events, last_seen_at)
  VALUES (p_creator_id, p_pixel_id, p_domain, 1, now())
  ON CONFLICT (creator_id, domain) DO UPDATE SET
    total_events = pixel_installs.total_events + 1,
    last_seen_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- DONE! 3-layer identity resolution schema ready.
-- ============================================
