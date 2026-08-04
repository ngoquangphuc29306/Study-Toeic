import { uniqueQuizLabels } from './labels';

describe('uniqueQuizLabels', () => {
  test('removes duplicate labels without mutating the source', () => {
    const source = ['Fast', ' fast ', 'Quick'];
    expect(uniqueQuizLabels(source)).toEqual(['Fast', 'Quick']);
    expect(source).toEqual(['Fast', ' fast ', 'Quick']);
  });

  test('handles empty input', () => {
    expect(uniqueQuizLabels([])).toEqual([]);
  });
});
