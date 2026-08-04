import { isCurrentRequest, type RequestGeneration } from './requestGeneration';

describe('request generation guard', () => {
  const expected: RequestGeneration = { userId: 'user-a', generation: 2, contextKey: 'all' };

  test('accepts the same user, generation, and context', () => {
    expect(isCurrentRequest(expected, expected)).toBe(true);
  });

  test('rejects a response from another user or generation', () => {
    expect(isCurrentRequest(expected, { ...expected, userId: 'user-b' })).toBe(false);
    expect(isCurrentRequest(expected, { ...expected, generation: 3 })).toBe(false);
  });

  test('rejects a response from another context when one is provided', () => {
    expect(isCurrentRequest(expected, { ...expected, contextKey: 'topic-2' })).toBe(false);
    expect(isCurrentRequest({ userId: 'user-a', generation: 2 }, expected)).toBe(true);
  });
});
