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
import { seededShuffle } from '../utils/shuffle';

function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizeSynonym(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

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

  return seededShuffle(candidates, `${target.vocabularyId}:distractors`).slice(0, count).map((item) => item.word);
}

export function buildMultipleChoiceQuestion(
  target: SynonymPracticeItem,
  pool: SynonymPracticeItem[]
): MultipleChoiceQuestion | null {
  const correct = seededShuffle(target.synonyms, `${target.vocabularyId}:correct`)[0];
  const distractors = getDistractorWords(target, pool, 3);
  const labels = uniqueLabels([correct || '', ...distractors]);
  if (!correct || labels.length < 4) return null;

  const options = seededShuffle(labels, `${target.vocabularyId}:options`).map((label, index) => ({
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
  const poolSeed = pool.map((item) => item.vocabularyId).join('|');
  return seededShuffle(pool, `multiple-choice:${poolSeed}:${count}`).map((target) => buildMultipleChoiceQuestion(target, pool)).filter(
    (question): question is MultipleChoiceQuestion => question !== null
  ).slice(0, count);
}

export function buildMatchingQuestion(
  pool: SynonymPracticeItem[],
  count: number
): MatchingQuestion | null {
  const poolSeed = pool.map((item) => item.vocabularyId).join('|');
  const items = seededShuffle(pool, `matching:${poolSeed}:${count}`).slice(0, Math.min(8, Math.max(4, count)));
  if (items.length < 2) return null;

  const usedSynonyms = new Set<string>();
  const pairs: MatchingPair[] = items.flatMap((item) => {
    const synonym = seededShuffle(item.synonyms, `${item.vocabularyId}:matching-synonyms`)
      .find((candidate) => !usedSynonyms.has(normalizeSynonym(candidate)));
    if (!synonym) return [];
    usedSynonyms.add(normalizeSynonym(synonym));
    return [{ id: `${item.vocabularyId}-pair`, item, synonym }];
  });

  return pairs.length >= 2 ? { id: `matching-${pairs.map((pair) => pair.id).join('-')}`, pairs } : null;
}

export function buildSelectAllQuestion(
  target: SynonymPracticeItem,
  pool: SynonymPracticeItem[]
): SelectAllQuestion | null {
  const correctAnswers = uniqueLabels(target.synonyms);
  if (correctAnswers.length > 8) return null;
  const distractors = getDistractorWords(target, pool, Math.max(0, 8 - correctAnswers.length));
  const labels = seededShuffle(uniqueLabels([...correctAnswers, ...distractors]), `${target.vocabularyId}:select-all`).slice(0, 8);

  if (labels.length < 6 || correctAnswers.length === 0) return null;

  const correctSet = new Set(correctAnswers.map(normalizeSynonym));

  return {
    id: target.vocabularyId,
    item: target,
    options: labels.map((label, index) => ({
      id: `${target.vocabularyId}-select-${index}`,
      label,
      isCorrect: correctSet.has(normalizeSynonym(label)),
    })),
    correctAnswers,
  };
}

export function buildSelectAllQuestions(
  pool: SynonymPracticeItem[],
  count: number
): SelectAllQuestion[] {
  const poolSeed = pool.map((item) => item.vocabularyId).join('|');
  return seededShuffle(pool, `select-all:${poolSeed}:${count}`).map((target) => buildSelectAllQuestion(target, pool)).filter(
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
