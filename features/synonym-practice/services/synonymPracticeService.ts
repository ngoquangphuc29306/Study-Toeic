import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import type {
  MatchingPair,
  MatchingQuestion,
  MultipleChoiceQuestion,
  SelectAllQuestion,
  SynonymPracticeItem,
} from '../types';
import { parseSynonyms } from '../utils/parseSynonyms';
import { normalizeSynonym } from '../utils/normalizeSynonym';
import { shuffle } from '../utils/shuffle';

export function mapVocabularyToSynonymItems(
  vocabularies: Vocabulary[],
  topics: Topic[],
  collections: Collection[]
): SynonymPracticeItem[] {
  return vocabularies.flatMap((vocabulary) => {
    const synonyms = parseSynonyms(vocabulary.synonyms);
    if (synonyms.length === 0) return [];

    const topic = topics.find((candidate) => candidate.id === vocabulary.topic_id);
    const collection = collections.find((candidate) => candidate.id === topic?.collection_id);

    return [{
      vocabularyId: vocabulary.id,
      word: vocabulary.word,
      meaning: vocabulary.meaning,
      ipa: vocabulary.phonetic_us || vocabulary.phonetic_uk,
      partOfSpeech: vocabulary.part_of_speech,
      topicId: topic?.id,
      topicName: topic?.title,
      collectionId: collection?.id,
      collectionName: collection?.title,
      synonyms,
      example: vocabulary.example,
      source: vocabulary,
    }];
  });
}

export function getFilteredSynonymItems(
  items: SynonymPracticeItem[],
  collectionId: string,
  topicId: string
): SynonymPracticeItem[] {
  return items.filter((item) =>
    (collectionId === 'all' || item.collectionId === collectionId) &&
    (topicId === 'all' || item.topicId === topicId)
  );
}

function getDistractorWords(target: SynonymPracticeItem, pool: SynonymPracticeItem[], count: number): string[] {
  const targetWord = normalizeSynonym(target.word);
  const targetSynonyms = new Set(target.synonyms.map(normalizeSynonym));
  const preferred = pool.filter((item) =>
    item.vocabularyId !== target.vocabularyId &&
    item.partOfSpeech === target.partOfSpeech &&
    (item.collectionId === target.collectionId || item.topicId === target.topicId)
  );
  const fallback = pool.filter((item) => item.vocabularyId !== target.vocabularyId);
  const candidates = [...preferred, ...fallback].filter((item, index, all) => {
    const normalized = normalizeSynonym(item.word);
    return normalized && normalized !== targetWord && !targetSynonyms.has(normalized) &&
      all.findIndex((candidate) => normalizeSynonym(candidate.word) === normalized) === index;
  });

  return shuffle(candidates).slice(0, count).map((item) => item.word);
}

export function buildMultipleChoiceQuestion(
  target: SynonymPracticeItem,
  pool: SynonymPracticeItem[]
): MultipleChoiceQuestion | null {
  const correct = shuffle(target.synonyms)[0];
  const distractors = getDistractorWords(target, pool, 3);
  if (!correct || distractors.length < 3) return null;

  const options = shuffle([correct, ...distractors]).map((label, index) => ({
    id: `${target.vocabularyId}-option-${index}`,
    label,
    isCorrect: normalizeSynonym(label) === normalizeSynonym(correct),
  }));

  return {
    id: target.vocabularyId,
    item: target,
    options,
    correctAnswers: [correct],
  };
}

export function buildMultipleChoiceQuestions(
  pool: SynonymPracticeItem[],
  count: number
): MultipleChoiceQuestion[] {
  return shuffle(pool).map((target) => buildMultipleChoiceQuestion(target, pool)).filter(
    (question): question is MultipleChoiceQuestion => question !== null
  ).slice(0, count);
}

export function buildMatchingQuestion(
  pool: SynonymPracticeItem[],
  count: number
): MatchingQuestion | null {
  const items = shuffle(pool).slice(0, Math.min(8, Math.max(4, count)));
  if (items.length < 2) return null;

  const usedSynonyms = new Set<string>();
  const pairs: MatchingPair[] = items.flatMap((item) => {
    const synonym = shuffle(item.synonyms).find((candidate) => !usedSynonyms.has(candidate));
    if (!synonym) return [];
    usedSynonyms.add(synonym);
    return [{ id: `${item.vocabularyId}-pair`, item, synonym }];
  });

  return pairs.length >= 2 ? { id: `matching-${Date.now()}`, pairs } : null;
}

export function buildSelectAllQuestion(
  target: SynonymPracticeItem,
  pool: SynonymPracticeItem[]
): SelectAllQuestion | null {
  const correctAnswers = [...target.synonyms];
  if (correctAnswers.length > 8) return null;
  const distractors = getDistractorWords(target, pool, Math.max(0, 8 - correctAnswers.length));
  const labels = shuffle([...correctAnswers, ...distractors]).slice(0, 8);

  if (labels.length < 6 || correctAnswers.length === 0) return null;

  return {
    id: target.vocabularyId,
    item: target,
    options: labels.map((label, index) => ({
      id: `${target.vocabularyId}-select-${index}`,
      label,
      isCorrect: correctAnswers.includes(label),
    })),
    correctAnswers,
  };
}

export function buildSelectAllQuestions(
  pool: SynonymPracticeItem[],
  count: number
): SelectAllQuestion[] {
  return shuffle(pool).map((target) => buildSelectAllQuestion(target, pool)).filter(
    (question): question is SelectAllQuestion => question !== null
  ).slice(0, count);
}

export function getEligibleCountByMode(mode: 'multiple-choice' | 'matching' | 'select-all' | 'typing', pool: SynonymPracticeItem[]): number {
  if (mode === 'multiple-choice') {
    return pool.filter((target) => Boolean(buildMultipleChoiceQuestion(target, pool))).length;
  }
  if (mode === 'select-all') {
    return pool.filter((target) => Boolean(buildSelectAllQuestion(target, pool))).length;
  }
  return pool.length;
}
