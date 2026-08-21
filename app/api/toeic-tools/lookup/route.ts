import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ToeicToolError } from '@/features/toeic-tests/toolContracts';
import { createToeicDictionaryProvider } from '@/features/toeic-tests/server/toeicDictionaryService';

const MAX_TERM_LENGTH = 80;
const MAX_CONTEXT_LENGTH = 500;

function errorResponse(error: ToeicToolError) {
  const status = error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'INVALID_INPUT' ? 400 : error.code === 'LOOKUP_RATE_LIMITED' ? 429 : error.code === 'LOOKUP_UNAVAILABLE' ? 503 : 500;
  return NextResponse.json({ code: error.code, message: error.code === 'LOOKUP_UNAVAILABLE' ? 'Tra từ hiện chưa khả dụng.' : error.message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ToeicToolError('UNAUTHENTICATED', 'Bạn cần đăng nhập để tra từ.');
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ToeicToolError('INVALID_INPUT', 'Dữ liệu tra từ không hợp lệ.');
    const input = body as { term?: unknown; context?: unknown };
    const term = typeof input.term === 'string' ? input.term.trim() : '';
    const context = input.context === undefined ? undefined : typeof input.context === 'string' ? input.context.trim() : null;
    if (!term || term.length > MAX_TERM_LENGTH || context === null || (context && context.length > MAX_CONTEXT_LENGTH)) throw new ToeicToolError('INVALID_INPUT', 'Từ hoặc ngữ cảnh tra cứu không hợp lệ.');
    const result = await createToeicDictionaryProvider().lookup(term, context);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) {
    if (cause instanceof ToeicToolError) return errorResponse(cause);
    return errorResponse(new ToeicToolError('LOOKUP_UNAVAILABLE', 'Tra từ hiện chưa khả dụng.', { cause }));
  }
}
