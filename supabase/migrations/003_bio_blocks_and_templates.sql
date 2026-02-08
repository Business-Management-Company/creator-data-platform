-- ============================================
-- BIO BLOCKS & TEMPLATES
-- ============================================

-- BIO_BLOCKS: block-based content system
CREATE TABLE IF NOT EXISTS public.bio_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('link', 'youtube', 'spotify', 'text', 'image', 'contact_form')),
  position INTEGER NOT NULL DEFAULT 0,
  block_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_blocks_user ON public.bio_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_bio_blocks_position ON public.bio_blocks(user_id, position);

ALTER TABLE public.bio_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bio blocks" ON public.bio_blocks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bio blocks" ON public.bio_blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bio blocks" ON public.bio_blocks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bio blocks" ON public.bio_blocks
  FOR DELETE USING (auth.uid() = user_id);

-- SUBSCRIBERS: add name and message for email capture
ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT;

-- CONTACT_SUBMISSIONS: for contact form block (allows multiple per email)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_profile ON public.contact_submissions(profile_id);
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact submissions" ON public.contact_submissions
  FOR SELECT USING (auth.uid() = profile_id);

-- STORAGE: Create buckets via Supabase Dashboard > Storage > New Bucket:
-- 1. "avatars" - Public bucket for profile avatars
-- 2. "images" - Public bucket for bio page image blocks
-- RLS: Allow authenticated users to upload to their own folder (avatars/{user_id}/*, images/{user_id}/*)
-- Bucket creation is typically done via Supabase UI or storage API at runtime
