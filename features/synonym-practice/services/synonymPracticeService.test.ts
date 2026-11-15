import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import {
  buildMatchingQuestion,
  buildMultipleChoiceQuestion,
  buildMultipleChoiceQuestions,
  buildSelectAllQuestion,
  buildSelectAllQuestions,
  getEligibleCountByMode,
  getEligibleSynonymItems,
  mapVocabularyToSynonymItems,
} from './synonymPracticeService';

const vocabulary = (id: string, word: string, synonyms: string): Vocabulary => ({
  id,
  topic_id: 'topic-1',
  word,
  meaning: `${word} meaning`,
  part_of_speech: 'noun',
  synonyms,
});

const topics: Topic[] = [{ id: 'topic-1', title: 'Topic', description: '', icon: 'BookOpen' }];
const collections: Collection[] = [{ id: 'collection-1', title: 'Collection' }];

const retryPool = () => mapVocabularyToSynonymItems([
  vocabulary('1', 'rapid', 'fast'),
  vocabulary('2', 'large', 'big'),
  vocabulary('3', 'smart', 'clever'),
  vocabulary('4', 'safe', 'secure'),
  vocabulary('5', 'calm', 'quiet'),
  vocabulary('6', 'happy', 'glad'),
], topics, collections);

describe('playable matching and preferred coverage targets', () => {
  const poolOf = (rows: Array<[string, string, string]>) => mapVocabularyToSynonymItems(
    rows.map(row => vocabulary(...row)), topics, collections,
  );

  test.each([
    [['1', 'rapid', 'fast'], ['2', 'swift', ' FAST ']],
    [['1', 'rapid', 'fast'], ['2', ' RAPID ', 'quick']],
  ] as Array<Array<[string, string, string]>>)('excludes every item without an individual playable partner: %j', (...rows) => {
    const pool = poolOf(rows);
    expect(getEligibleCountByMode('matching', pool)).toBe(0);
    expect(buildMatchingQuestion(pool, 8, { targets: pool })).toBeNull();
  });

  test('never puts duplicate normalized visible source words in one round', () => {
    const pool = poolOf([['1', 'rapid', 'fast'], ['2', ' RAPID ', 'quick'], ['3', 'large', 'big']]);
    const round = buildMatchingQuestion(pool, 8, { targets: pool });
    expect(round?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['1', '3']);
    expect(getEligibleCountByMode('matching', pool)).toBe(3);
  });

  test('scans past eight colliding candidates for a playable partner', () => {
    const pool = poolOf([
      ...Array.from({ length: 8 }, (_, i): [string, string, string] => [`${i}`, `word${i}`, 'shared']),
      ['late', 'later', 'distinct'],
    ]);
    expect(buildMatchingQuestion(pool, 8, { targets: pool })?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['0', 'late']);
    expect(getEligibleCountByMode('matching', pool)).toBe(9);
  });

  test('reassigns an earlier synonym instead of falsely rejecting a viable target', () => {
    const pool = poolOf([['1', 'rapid', 'unique, shared'], ['2', 'swift', 'shared']]);
    expect(buildMatchingQuestion(pool, 8, { targets: pool })?.pairs.map(pair => pair.synonym)).toEqual(['unique', 'shared']);
    expect(getEligibleCountByMode('matching', pool)).toBe(2);
  });

  test('prefers ordered unseen targets and adds only one distinct seen support if needed', () => {
    const pool = retryPool();
    expect(buildMatchingQuestion(pool, 8, { targets: [pool[4]] })?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['5', '1']);
    expect(buildMatchingQuestion(pool, 8, { targets: [pool[4], pool[3]] })?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['5', '4']);
  });

  test('does not turn empty preferred targets into a normal round', () => {
    expect(buildMatchingQuestion(retryPool(), 8, { targets: [] })).toBeNull();
  });

  test('counts only individual rows with a playable partner, skipping an unusable preferred leftover', () => {
    const pool = poolOf([['1', 'same', 'shared'], ['2', 'same', 'other'], ['3', 'distinct', 'shared']]);
    expect(getEligibleCountByMode('matching', pool)).toBe(2);
    expect(buildMatchingQuestion(pool, 8, { targets: pool })?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['2', '3']);
    expect(buildMatchingQuestion(pool, 8, { targets: [pool[0]] })).toBeNull();
  });

  test('uses only the previous result pool as retry support', () => {
    const pool = retryPool();
    const previous = [pool[3], pool[4]];
    expect(buildMatchingQuestion(previous, 8, { targets: [pool[4]] })?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['5', '4']);
    expect(buildMatchingQuestion([pool[4]], 8, { targets: [pool[4]] })).toBeNull();
  });

  test('caps rounds at eight while preserving preferred order and immutable inputs', () => {
    const pool = poolOf(Array.from({ length: 12 }, (_, i) => [`${i}`, `word${i}`, `syn${i}`]));
    const options = { targets: [...pool].reverse() };
    const before = JSON.stringify({ pool, options });
    const round = buildMatchingQuestion(pool, 20, options);
    expect(round?.pairs.map(pair => pair.item.vocabularyId)).toEqual(['11', '10', '9', '8', '7', '6', '5', '4']);
    expect(buildMatchingQuestion(pool, 20, options)).toEqual(round);
    expect(JSON.stringify({ pool, options })).toBe(before);
  });
});

describe('legacy batch output', () => {
  test('preserves omitted-options question order, labels, IDs and answers', () => {
    const pool = retryPool();
    const questions = [
      ...buildMultipleChoiceQuestions(pool, 1),
      ...buildSelectAllQuestions(pool, 1),
    ];
    for (const question of questions) {
      expect(question.item).toEqual(pool.find((item) => item.vocabularyId === question.id));
    }
    expect(questions.map((question) => ({ ...question, item: question.item.vocabularyId })))
      .toMatchInlineSnapshot(`
        [
          {
            "correctAnswers": [
              "fast",
            ],
            "id": "1",
            "item": "1",
            "options": [
              {
                "id": "1-option-0",
                "isCorrect": false,
                "label": "large",
              },
              {
                "id": "1-option-1",
                "isCorrect": false,
                "label": "happy",
              },
              {
                "id": "1-option-2",
                "isCorrect": true,
                "label": "fast",
              },
              {
                "id": "1-option-3",
                "isCorrect": false,
                "label": "safe",
              },
            ],
          },
          {
            "correctAnswers": [
              "fast",
            ],
            "id": "1",
            "item": "1",
            "options": [
              {
                "id": "1-select-0",
                "isCorrect": false,
                "label": "safe",
              },
              {
                "id": "1-select-1",
                "isCorrect": false,
                "label": "happy",
              },
              {
                "id": "1-select-2",
                "isCorrect": false,
                "label": "calm",
              },
              {
                "id": "1-select-3",
                "isCorrect": true,
                "label": "fast",
              },
              {
                "id": "1-select-4",
                "isCorrect": false,
                "label": "large",
              },
              {
                "id": "1-select-5",
                "isCorrect": false,
                "label": "smart",
              },
            ],
          },
        ]
      `);
  });
});

describe.each([
  { mode: 'multiple-choice', build: buildMultipleChoiceQuestions, minimumPool: 4 },
  { mode: 'select-all', build: buildSelectAllQuestions, minimumPool: 6 },
])('$mode target and option pools', ({ build, minimumPool }) => {
  test.each([0, -1])('returns no questions without inspecting the pool for count %s', count => {
    const pool = retryPool();
    Object.defineProperty(pool[0], 'vocabularyId', { get() { throw new Error('unneeded pool inspection'); } });
    expect(build(pool, count)).toEqual([]);
  });

  test('stops building after enough valid targets, scanning past an invalid target', () => {
    const pool = retryPool();
    const invalid = { ...pool[0], vocabularyId: 'invalid', synonyms: [] };
    const unneeded = { ...pool[1], vocabularyId: 'unneeded' };
    Object.defineProperty(unneeded, 'synonyms', { get() { throw new Error('unneeded question construction'); } });
    expect(build([...pool, invalid, unneeded], 1, { targets: [invalid, pool[0], unneeded] })
      .map(question => question.id)).toEqual(['1']);
  });

  test('builds a one-target retry with distractors from the full pool', () => {
    const pool = retryPool().slice(0, minimumPool);
    const questions = build(pool, 5, { targets: [pool[0]] });

    expect(questions.map((question) => question.item.vocabularyId)).toEqual(['1']);
    const labels = questions[0].options.map((option) => option.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBeGreaterThanOrEqual(minimumPool);
    expect(labels.length).toBeLessThanOrEqual(minimumPool === 4 ? 4 : 8);
    expect(questions[0].correctAnswers).toEqual(['fast']);
    expect(labels).toContain('fast');
    expect(labels.filter((label) => label !== 'fast').every((label) =>
      pool.slice(1).some((item) => item.word === label)
    )).toBe(true);
  });

  test('returns no questions when the full pool lacks enough options', () => {
    const pool = retryPool().slice(0, minimumPool - 1);
    expect(build(pool, 5, { targets: [pool[0]] })).toEqual([]);
  });

  test('retains explicit planner order before applying the count limit', () => {
    const pool = retryPool();
    const targets = [pool[4], pool[0], pool[3]];
    expect(build(pool, 2, { targets }).map((question) => question.id)).toEqual(['5', '1']);
  });

  test('deduplicates target IDs and skips out-of-pool targets', () => {
    const pool = retryPool();
    const outside = { ...pool[0], vocabularyId: 'outside' };
    const targets = [outside, pool[4], { ...pool[4] }, pool[0]];
    expect(build(pool, 6, { targets }).map((question) => question.id)).toEqual(['5', '1']);
    expect(build(pool, 6, { targets: [outside] })).toEqual([]);
  });

  test('does not replace empty explicit targets with the full pool', () => {
    expect(build(retryPool(), 5, { targets: [] })).toEqual([]);
  });

  test('uses an explicit seed for deterministic target reordering', () => {
    const pool = retryPool();
    const targets = [...pool].reverse();
    const first = build(pool, 6, { targets, seed: 'retry-cycle-1' });
    expect(first).toHaveLength(6);
    expect(first).toEqual(build(pool, 6, { targets, seed: 'retry-cycle-1' }));
    expect(first.map((question) => question.id)).not.toEqual(targets.map((item) => item.vocabularyId));
    expect(first.map((question) => question.id)).not.toEqual(
      build(pool, 6, { targets, seed: 'retry-cycle-2' }).map((question) => question.id)
    );
  });

  test('keeps the legacy shuffle when targets and seed are unprovided', () => {
    const pool = retryPool();
    expect(build(pool, 6, {})).toEqual(build(pool, 6));
    expect(build(pool, 6, { targets: undefined })).toEqual(build(pool, 6));
    expect(build(pool, 6, { seed: 'cycle-1' })).toEqual(build(pool, 6, { seed: 'cycle-1' }));
    expect(build(pool, 6, { seed: 'cycle-1' })).not.toEqual(build(pool, 6, { seed: 'cycle-2' }));
  });

  test('does not mutate pool items, target items, arrays or options', () => {
    const pool = retryPool();
    const targets = [pool[4], pool[0], pool[3]];
    const options = { targets, seed: 'immutable' };
    const before = JSON.stringify({ pool, options });
    build(pool, 2, options);
    build(pool, 2, { targets });
    expect(JSON.stringify({ pool, options })).toBe(before);
  });
});

describe('synonym question generation', () => {
  test.each(['multiple-choice', 'select-all', 'matching', 'typing'] as const)('shares ordered immutable %s eligibility with counts', mode => {
    const pool = retryPool();
    const before = JSON.stringify(pool);
    const eligible = getEligibleSynonymItems(mode, pool);
    expect(eligible.map(item => item.vocabularyId)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(getEligibleCountByMode(mode, pool)).toBe(eligible.length);
    expect(JSON.stringify(pool)).toBe(before);
  });

  test.each(['multiple-choice', 'select-all'] as const)('counts only buildable %s targets', mode => {
    const pool = retryPool();
    const invalid = { ...pool[0], vocabularyId: 'invalid', synonyms: [] };
    expect(getEligibleCountByMode(mode, [...pool, invalid])).toBe(6);
    expect(getEligibleCountByMode(mode, pool.slice(0, 3))).toBe(0);
  });

  test('keeps the preferred spelling of duplicate labels and excludes source words and synonyms', () => {
    const target = retryPool()[0];
    const fallback = { ...target, vocabularyId: 'fallback', word: ' LARGE ', partOfSpeech: 'verb', collectionId: 'other', topicId: 'other' };
    const preferred = { ...target, vocabularyId: 'preferred', word: 'large' };
    const pool = [target, fallback, ...retryPool().slice(2), preferred,
      ...[' FAST ', ' RAPID ', '   '].map((word, i) => ({ ...target, vocabularyId: `excluded${i}`, word })),
    ];
    const question = buildSelectAllQuestion(target, pool)!;
    const labels = question.options.map(option => option.label);
    expect(labels).toHaveLength(6);
    expect(labels).toContain('large');
    expect(labels).not.toContain(' LARGE ');
    expect(labels).not.toContain(' FAST ');
    expect(labels).not.toContain(' RAPID ');
    expect(labels).not.toContain('   ');
    expect(new Set(labels.map(label => label.trim().toLowerCase())).size).toBe(labels.length);
  });

  test('is deterministic and does not mutate input', () => {
    const source = [
      vocabulary('1', 'rapid', 'fast, quick'),
      vocabulary('2', 'large', 'big, huge'),
      vocabulary('3', 'smart', 'clever, bright'),
      vocabulary('4', 'safe', 'secure, protected'),
    ];
    const items = mapVocabularyToSynonymItems(source, topics, collections);
    const original = JSON.stringify(items);

    expect(buildMultipleChoiceQuestion(items[0], items)).toEqual(buildMultipleChoiceQuestion(items[0], items));
    expect(buildMatchingQuestion(items, 4)).toEqual(buildMatchingQuestion(items, 4));
    expect(buildSelectAllQuestion(items[0], items)).toEqual(buildSelectAllQuestion(items[0], items));
    expect(JSON.stringify(items)).toBe(original);
  });

  test('does not generate duplicate normalized labels and handles a small pool', () => {
    const source = [vocabulary('1', 'rapid', 'fast, FAST'), vocabulary('2', 'large', 'big')];
    const items = mapVocabularyToSynonymItems(source, topics, collections);

    expect(buildMultipleChoiceQuestion(items[0], items)).toBeNull();
    expect(buildMatchingQuestion(items, 4)?.pairs.length).toBe(2);
  });
});
