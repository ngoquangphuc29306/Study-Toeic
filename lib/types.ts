export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'preposition' | 'conjunction';

export type LearningStatus = 'new' | 'learning' | 'mastered';

export interface Collection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
  // Computed properties
  total_topics?: number;
  total_words?: number;
}

export interface Topic {
  id: string;
  collection_id?: string; // Optional collection reference
  title: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  category?: string;
  created_at?: string;
  updated_at?: string;
  // Computed properties
  total_words?: number;
  mastered_words?: number;
  learning_words?: number;
}

export interface Vocabulary {
  id: string;
  topic_id: string; // section/topic ID
  word: string;
  phonetic_uk?: string; // IPA-UK
  phonetic_us?: string; // IPK-US / IPA-US
  part_of_speech: PartOfSpeech | string;
  meaning: string;
  example?: string;
  example_translation?: string; // example_vi
  synonyms?: string; // Từ đồng nghĩa
  collocations?: string; // Cụm từ
  audio_url?: string;
  note?: string;
  created_at?: string;
  // User progress relation (joined)
  status?: LearningStatus;
  review_count?: number;
  last_reviewed_at?: string;
  next_review_at?: string;
  interval_hours?: number;
  again_count?: number;
  is_difficult?: boolean;
}

export interface UserVocabProgress {
  id?: string;
  user_id?: string;
  vocabulary_id: string;
  status: LearningStatus;
  review_count: number;
  last_reviewed_at: string;
  next_review_at?: string;
  interval_hours?: number;
  again_count?: number;
  mastery_level?: number; // 0 to 5
}

export interface StudyStats {
  totalWords: number;
  masteredCount: number;
  learningCount: number;
  newCount: number;
  dailyStreak: number;
  lastStudyDate?: string;
  todayStudiedCount: number;
}

export interface QuizQuestion {
  vocabulary: Vocabulary;
  options: string[]; // 4 choice strings
  correctAnswerIndex: number;
  questionType: 'word-to-meaning' | 'meaning-to-word' | 'fill-example';
  promptText: string;
}

export interface QuizResult {
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  incorrectVocabularies: Vocabulary[];
}
