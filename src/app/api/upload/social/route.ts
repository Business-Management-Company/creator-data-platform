import { createServerSupabase } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const BUCKET = 'images';

// POST /api/upload/social - Upload image or video for social posts
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'File must be image or video' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'mp4');
  const path = `${user.id}/social/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
      return NextResponse.json({
        error: 'Storage bucket not configured. Create an "images" bucket in Supabase Storage.',
      }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return NextResponse.json({
    url: urlData.publicUrl,
    path: data.path,
    type: isImage ? 'image' : 'video',
  });
}
