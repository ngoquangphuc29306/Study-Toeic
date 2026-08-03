import type { Vocabulary, Topic, Collection } from '../../lib/types';

export type SynonymPracticeMode = 'multiple-choice' | 'matching' | 'select-all' | 'typing';

export interface SynonymPracticeItem {
  vocabularyId: string;
  word: string;
  meaning: string;
  ipa?: string;
  partOfSpeech?: string;
  topicId?: string;
  topicName?: string;
  collectionId?: string;
  collectionName?: string;
  synonyms: string[];
  example?: string;
  source: Vocabulary;
}

export interface SynonymPracticeOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface MultipleChoiceQuestion {
  id: string;
  item: SynonymPracticeItem;
  options: SynonymPracticeOption[];
  correctAnswers: string[];
}

export interface SelectAllQuestion {
  id: string;
  item: SynonymPracticeItem;
  options: SynonymPracticeOption[];
  correctAnswers: string[];
}

export interface MatchingPair {
  id: string;
  item: SynonymPracticeItem;
  synonym: string;
}

export interface MatchingQuestion {
  id: string;
  pairs: MatchingPair[];
}

export interface SynonymSessionAnswer {
  vocabularyId: string;
  word: string;
  userAnswers: string[];
  correctAnswers: string[];
  isCorrect: boolean;
}

export interface SynonymPracticeResult {
  mode: SynonymPracticeMode;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  elapsedSeconds: number;
  bestStreak: number;
  answers: SynonymSessionAnswer[];
}

export interface SynonymPracticeFilters {
  collectionId: string;
  topicId: string;
}

export interface SynonymPracticeData {
  items: SynonymPracticeItem[];
  topics: Topic[];
  collections: Collection[];
}
