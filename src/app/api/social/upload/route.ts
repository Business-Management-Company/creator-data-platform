import { createServerSupabase } from '@/lib/supabase/server';
import { getUploadPostClient } from '@/lib/upload-post';
import { NextRequest, NextResponse } from 'next/server';

type Platform = 'tiktok' | 'instagram' | 'youtube' | 'linkedin' | 'facebook' | 'x' | 'bluesky';

const VIDEO_PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'bluesky'];
const PHOTO_PLATFORMS: Platform[] = ['tiktok', 'instagram', 'linkedin', 'facebook', 'x', 'bluesky'];
const TEXT_PLATFORMS: Platform[] = ['x', 'linkedin', 'facebook', 'bluesky'];

// POST /api/social/upload - Upload content via Upload-Post API
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
    scheduledAt?: string;
  };

  if (!content || !Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'Content and at least one platform required' }, { status: 400 });
  }

  const username = user.id.replace(/-/g, '_');
  const opts = {
    title: content,
    user: username,
    platforms: platforms as Platform[],
    scheduledDate: scheduledAt || undefined,
    timezone: 'UTC',
    asyncUpload: true,
  };

  try {
    const client = getUploadPostClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
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
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        published_at: scheduledAt ? null : new Date().toISOString(),
        status: scheduledAt ? 'scheduled' : 'published',
        upload_post_response: response,
        request_id: response?.request_id || null,
        job_id: response?.data?.job_id || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, post, uploadResponse: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
