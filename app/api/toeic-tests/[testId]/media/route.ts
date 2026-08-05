import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signToeicMediaUrls } from '@/features/toeic-tests/server/toeicMediaService';
import { ToeicReadError } from '@/features/toeic-tests/readContracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_PATHS = 20;
const MAX_BODY_LENGTH = 8192;

function responseBody(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function statusForError(error: ToeicReadError): number {
  switch (error.code) {
    case 'UNAUTHENTICATED': return 401;
    case 'INVALID_INPUT': return 400;
    case 'TEST_NOT_FOUND':
    case 'MEDIA_NOT_FOUND': return 404;
    case 'TEST_NOT_PUBLISHED': return 403;
    default: return 500;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ testId: string }> }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return responseBody({ error: 'UNAUTHENTICATED' }, 401);

    const { testId } = await context.params;
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
      return responseBody({ error: 'INVALID_INPUT' }, 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return responseBody({ error: 'INVALID_INPUT' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return responseBody({ error: 'INVALID_INPUT' }, 400);
    }

    const paths = (body as { paths?: unknown }).paths;
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS ||
        paths.some((path) => typeof path !== 'string')) {
      return responseBody({ error: 'INVALID_INPUT' }, 400);
    }

    const result = await signToeicMediaUrls({
      userId: user.id,
      testId,
      paths,
      expiresInSeconds: (body as { expiresInSeconds?: number }).expiresInSeconds,
    });
    return responseBody({ items: result }, 200);
  } catch (error) {
    if (error instanceof ToeicReadError) {
      return responseBody({ error: error.code }, statusForError(error));
    }
    return responseBody({ error: 'MEDIA_SIGNING_FAILED' }, 500);
  }
}
