import { UploadPost } from 'upload-post';

const apiKey = process.env.UPLOAD_POST_API_KEY;

export function getUploadPostClient(): UploadPost {
  if (!apiKey) {
    throw new Error('UPLOAD_POST_API_KEY is not configured');
  }
  return new UploadPost(apiKey);
}
