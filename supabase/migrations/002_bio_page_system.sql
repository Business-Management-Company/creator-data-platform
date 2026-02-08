-- ============================================
-- BIO PAGE SYSTEM - Linktree competitor
-- ============================================

-- PROFILES: add theme, bio_text, display_name, social_links, page_settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS bio_text TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS page_settings JSONB DEFAULT '{}'::jsonb;

-- Backfill display_name from full_name, bio_text from bio_description
UPDATE public.profiles SET display_name = full_name WHERE display_name IS NULL AND full_name IS NOT NULL;
UPDATE public.profiles SET bio_text = bio_description WHERE bio_text IS NULL AND bio_description IS NOT NULL;

-- LINKS: add thumbnail_url, icon, priority, schedule_start, schedule_end, link_order
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_order INTEGER;

-- Backfill link_order from bio_order for bio links
UPDATE public.links SET link_order = bio_order WHERE is_bio_link = true AND link_order IS NULL;

-- SUBSCRIBERS: email capture for bio page
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  source TEXT DEFAULT 'bio_page',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, email)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_profile ON public.subscribers(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers(email);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Subscribers: users can view their own; inserts via API with service role (public form)
CREATE POLICY "Users can view own subscribers" ON public.subscribers
  FOR SELECT USING (auth.uid() = profile_id);
