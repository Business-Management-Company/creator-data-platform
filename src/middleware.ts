import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match dashboard and auth routes, skip static files and API
    '/((?!_next/static|_next/image|favicon.ico|api/track|r/).*)',
  ],
};
