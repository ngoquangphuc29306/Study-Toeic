import { seededShuffle } from './seededShuffle';

describe('seededShuffle', () => {
  test('returns the same output for the same seed', () => {
    const input = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(input, 'seed-1')).toEqual(seededShuffle(input, 'seed-1'));
  });

  test('does not mutate the source array', () => {
    const input = ['a', 'b', 'c'];
    const original = [...input];
    seededShuffle(input, 'seed-2');
    expect(input).toEqual(original);
  });

  test('handles empty and single-item arrays', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
    expect(seededShuffle(['only'], 'seed')).toEqual(['only']);
  });
});
