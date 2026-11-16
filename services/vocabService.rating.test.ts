import { beforeEach, expect, it, vi } from 'vitest';
import { updateUserProgress } from './vocabService';
import { AuthSessionExpiredError } from '../lib/supabase/authRetry';

const requests = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser: requests.getUser }, rpc: requests.rpc }) }));
const result = { status: 'success', new_status: 'learning', interval_hours: 24, next_review_at: null, review_count: 1, again_count: 0 };
beforeEach(() => {
  vi.clearAllMocks();
  requests.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });
  requests.rpc.mockResolvedValue({ data: result, error: null });
});
it('uses the authorized RPC directly with no getUser preflight or owner payload', async () => {
  await expect(updateUserProgress('v0', 'learning', 'good', 'key')).resolves.toEqual(result);
  expect(requests.getUser).not.toHaveBeenCalled();
  expect(requests.rpc).toHaveBeenCalledExactlyOnceWith('submit_vocabulary_rating', { p_vocabulary_id: 'v0', p_rating: 'good', p_idempotency_key: 'key' });
});
it('propagates the RPC authentication rejection without a preflight', async () => {
  requests.rpc.mockResolvedValue({ data: null, error: { message: 'Not authenticated' } });
  await expect(updateUserProgress('v0', 'learning', 'good', 'key')).rejects.toThrow('Phiên đăng nhập đã hết hạn');
  expect(requests.getUser).not.toHaveBeenCalled();
  expect(requests.rpc).toHaveBeenCalledTimes(1);
});
it.each([['learning', 'good'], ['mastered', 'mastered']] as const)('preserves the default rating for %s', async (status, rating) => {
  await updateUserProgress('v0', status, undefined, 'key');
  expect(requests.rpc.mock.calls[0][1]).toMatchObject({ p_rating: rating, p_idempotency_key: 'key' });
});

it.each([
  { status: 401, message: 'Unauthorized' },
  { code: 'PGRST301', message: 'JWT expired' },
  { message: 'Not authenticated' },
])('returns a localized session-expired error for RPC auth failure %j', async (error) => {
  requests.rpc.mockResolvedValue({ data: null, error });
  const pending = updateUserProgress('v0', 'learning', 'good', 'original-key');
  await expect(pending).rejects.toBeInstanceOf(AuthSessionExpiredError);
  await expect(pending).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  expect(requests.getUser).not.toHaveBeenCalled();
  expect(requests.rpc).toHaveBeenCalledTimes(1);
});
