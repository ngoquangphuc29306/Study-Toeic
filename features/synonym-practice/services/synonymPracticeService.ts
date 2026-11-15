import type { Collection, Topic, Vocabulary } from '../../../lib/types';
import type {
  MatchingPair,
  MatchingQuestion,
  MultipleChoiceQuestion,
  SelectAllQuestion,
  SynonymPracticeItem,
  SynonymPracticeMode,
} from '../types';
import { parseSynonyms } from '../utils/parseSynonyms';
import { normalizeSynonym } from '../utils/normalizeSynonym';
import { seededShuffle } from '../utils/shuffle';

export interface QuestionBuildOptions {
  targets?: SynonymPracticeItem[];
  seed?: string;
}

function getQuestionTargets(
  pool: SynonymPracticeItem[],
  legacySeed: string,
  options?: QuestionBuildOptions
): SynonymPracticeItem[] {
  if (options?.targets === undefined) {
    return seededShuffle(pool, options?.seed ?? legacySeed);
  }

  const poolIds = new Set(pool.map((item) => item.vocabularyId));
  const seenIds = new Set<string>();
  const targets = options.targets.filter((item) => {
    if (!poolIds.has(item.vocabularyId) || seenIds.has(item.vocabularyId)) return false;
    seenIds.add(item.vocabularyId);
    return true;
  });

  return options.seed === undefined ? targets : seededShuffle(targets, options.seed);
}

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
  const seenWords = new Set<string>();
  const candidates = [...preferred, ...fallback].filter((item) => {
    const normalized = normalizeSynonym(item.word);
    if (!normalized || normalized === targetWord || targetSynonyms.has(normalized) || seenWords.has(normalized)) return false;
    seenWords.add(normalized);
    return true;
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
  count: number,
  options?: QuestionBuildOptions
): MultipleChoiceQuestion[] {
  const limit = Math.trunc(count);
  if (!(limit > 0)) return [];
  const poolSeed = pool.map((item) => item.vocabularyId).join('|');
  const questions: MultipleChoiceQuestion[] = [];
  for (const target of getQuestionTargets(pool, `multiple-choice:${poolSeed}:${count}`, options)) {
    const question = buildMultipleChoiceQuestion(target, pool);
    if (question) questions.push(question);
    if (questions.length >= limit) break;
  }
  return questions;
}

/** Find distinct labels, moving earlier assignments when a later item needs one. */
function assignMatchingPairs(items: SynonymPracticeItem[]): MatchingPair[] | null {
  const words = items.map(item => normalizeSynonym(item.word));
  if (words.some(word => !word) || new Set(words).size !== words.length) return null;
  const labels = items.map(item => seededShuffle(uniqueLabels(item.synonyms), `${item.vocabularyId}:matching-synonyms`));
  const owners = new Map<string, number>();
  const assigned: string[] = [];
  const assign = (index: number, visited: Set<string>): boolean => {
    for (const label of labels[index]) {
      const normalized = normalizeSynonym(label);
      if (visited.has(normalized)) continue;
      visited.add(normalized);
      const owner = owners.get(normalized);
      if (owner === undefined || assign(owner, visited)) {
        owners.set(normalized, index);
        assigned[index] = label;
        return true;
      }
    }
    return false;
  };
  for (let index = 0; index < items.length; index += 1) {
    if (!assign(index, new Set())) return null;
  }
  return items.map((item, index) => ({ id: `${item.vocabularyId}-pair`, item, synonym: assigned[index] }));
}

/** Eligibility belongs to each row, including duplicate words that can play in separate rounds. */
export function getMatchingEligibleItems(pool: SynonymPracticeItem[]): SynonymPracticeItem[] {
  const items = [...new Map(pool.map(item => [item.vocabularyId, item])).values()];
  return items.filter(item => items.some(partner => partner.vocabularyId !== item.vocabularyId &&
    assignMatchingPairs([item, partner]) !== null));
}

export function getMatchingEligibleCount(pool: SynonymPracticeItem[]): number {
  return getMatchingEligibleItems(pool).length;
}

export function buildMatchingQuestion(
  pool: SynonymPracticeItem[],
  count: number,
  options?: QuestionBuildOptions,
): MatchingQuestion | null {
  const eligible = getMatchingEligibleItems(pool);
  const eligibleIds = new Set(eligible.map(item => item.vocabularyId));
  const poolSeed = pool.map(item => item.vocabularyId).join('|');
  const targets = getQuestionTargets(pool, `matching:${poolSeed}:${count}`, options)
    .filter(item => eligibleIds.has(item.vocabularyId));
  const limit = Math.min(8, Math.max(2, count));
  let pairs: MatchingPair[] = [];
  for (const item of targets) {
    const next = assignMatchingPairs([...pairs.map(pair => pair.item), item]);
    if (next) pairs = next;
    if (pairs.length >= limit) break;
  }
  if (pairs.length === 1) {
    const targetIds = new Set(targets.map(item => item.vocabularyId));
    for (const support of eligible) {
      if (targetIds.has(support.vocabularyId)) continue;
      const next = assignMatchingPairs([pairs[0].item, support]);
      if (next) { pairs = next; break; }
    }
  }
  return pairs.length >= 2 ? { id: `matching-${pairs.map(pair => pair.id).join('-')}`, pairs } : null;
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
  count: number,
  options?: QuestionBuildOptions
): SelectAllQuestion[] {
  const limit = Math.trunc(count);
  if (!(limit > 0)) return [];
  const poolSeed = pool.map((item) => item.vocabularyId).join('|');
  const questions: SelectAllQuestion[] = [];
  for (const target of getQuestionTargets(pool, `select-all:${poolSeed}:${count}`, options)) {
    const question = buildSelectAllQuestion(target, pool);
    if (question) questions.push(question);
    if (questions.length >= limit) break;
  }
  return questions;
}

export function getEligibleSynonymItems(mode: SynonymPracticeMode, pool: SynonymPracticeItem[]): SynonymPracticeItem[] {
  if (mode === 'matching') return getMatchingEligibleItems(pool);
  if (mode === 'multiple-choice') {
    return pool.filter((target) => Boolean(buildMultipleChoiceQuestion(target, pool)));
  }
  if (mode === 'select-all') {
    return pool.filter((target) => Boolean(buildSelectAllQuestion(target, pool)));
  }
  return pool;
}

export function getEligibleCountByMode(mode: SynonymPracticeMode, pool: SynonymPracticeItem[]): number {
  return getEligibleSynonymItems(mode, pool).length;
}
