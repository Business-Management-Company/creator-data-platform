import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextRequest, NextResponse } from 'next/server';

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'linkedin' | 'facebook' | 'x' | 'bluesky';

const VIDEO_PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'bluesky'];
const PHOTO_PLATFORMS: Platform[] = ['tiktok', 'instagram', 'linkedin', 'facebook', 'x', 'bluesky'];
const TEXT_PLATFORMS: Platform[] = ['x', 'linkedin', 'facebook', 'bluesky'];

// POST /api/social/schedule - Schedule a post via Upload-Post API
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { content, mediaUrl, mediaType, platforms, scheduledAt } = body as {
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    platforms: Platform[];
    scheduledAt: string;
  };

  if (!content || !Array.isArray(platforms) || platforms.length === 0 || !scheduledAt) {
    return NextResponse.json({ error: 'Content, platforms, and scheduledAt required' }, { status: 400 });
  }

  const username = user.id.replace(/-/g, '_');
  const opts = {
    title: content,
    user: username,
    platforms: platforms as Platform[],
    scheduledDate: new Date(scheduledAt).toISOString(),
    timezone: 'UTC',
    asyncUpload: true,
  };

  try {
    const client = getUploadPostClient();

    let response;
    if (mediaUrl && mediaType === 'video') {
      const videoPlatforms = platforms.filter((p) => VIDEO_PLATFORMS.includes(p));
      response = await client.upload(mediaUrl, { ...opts, platforms: videoPlatforms });
    } else if (mediaUrl && (mediaType === 'image' || !mediaType)) {
      const photoPlatforms = platforms.filter((p) => PHOTO_PLATFORMS.includes(p));
      response = await client.uploadPhotos([mediaUrl], { ...opts, platforms: photoPlatforms as ('tiktok' | 'instagram' | 'linkedin' | 'facebook' | 'x' | 'bluesky')[] });
    } else {
      const textPlatforms = platforms.filter((p) => TEXT_PLATFORMS.includes(p));
      response = await client.uploadText({ ...opts, platforms: textPlatforms as ('x' | 'linkedin' | 'facebook' | 'bluesky')[] });
    }

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        profile_id: user.id,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        platforms,
        scheduled_at: new Date(scheduledAt).toISOString(),
        published_at: null,
        status: 'scheduled',
        upload_post_response: response,
        request_id: response.request_id,
        job_id: response.data?.job_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, post, uploadResponse: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Schedule failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
