-- ============================================
-- SOCIAL HUB - Upload-Post integration
-- ============================================

-- SOCIAL_ACCOUNTS: connected social accounts per profile
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'bluesky')),
  account_name TEXT,
  account_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_profile ON public.social_accounts(profile_id);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social accounts" ON public.social_accounts
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own social accounts" ON public.social_accounts
  FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own social accounts" ON public.social_accounts
  FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can delete own social accounts" ON public.social_accounts
  FOR DELETE USING (auth.uid() = profile_id);

-- SOCIAL_POSTS: posts created via Upload-Post
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  platforms JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  upload_post_response JSONB,
  request_id TEXT,
  job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_profile ON public.social_posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON public.social_posts(created_at DESC);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social posts" ON public.social_posts
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own social posts" ON public.social_posts
  FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own social posts" ON public.social_posts
  FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Users can delete own social posts" ON public.social_posts
  FOR DELETE USING (auth.uid() = profile_id);
