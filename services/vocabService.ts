import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Collection, Topic, Vocabulary, UserVocabProgress, StudyStats, LearningStatus } from '../lib/types';
import { INITIAL_COLLECTIONS, INITIAL_TOPICS, INITIAL_VOCABULARIES } from '../lib/initialData';
import {
  getCollections as getCollectionsFromSupabase,
  createCollection as createCollectionInSupabase,
  updateCollection as updateCollectionInSupabase,
  deleteCollection as deleteCollectionInSupabase,
} from './collectionService';
import {
  getTopics as getTopicsFromSupabase,
  createTopic as createTopicInSupabase,
  updateTopic as updateTopicInSupabase,
  deleteTopic as deleteTopicInSupabase,
} from './topicService';
import {
  getVocabularies as getVocabulariesFromSupabase,
  createVocabulary as createVocabularyInSupabase,
  bulkCreateVocabularies as bulkCreateVocabulariesInSupabase,
  updateVocabulary as updateVocabularyInSupabase,
  deleteVocabulary as deleteVocabularyInSupabase,
} from './vocabularyService';
import { CollectionHasChildrenError } from './collectionErrors';
import { TopicHasVocabulariesError } from './topicErrors';
import { VocabularyValidationError } from './vocabularyErrors';
import {
  getUserScopedArray,
  setUserScopedArray,
  getUserScopedObject,
  setUserScopedObject,
} from './localStorageHelpers';
import { createClient } from '@/lib/supabase/client';
import { calculateNextReview } from '@/lib/srs/scheduler';
import type { SrsProgress } from '@/lib/srs/types';
import { getConsecutiveLocalStreak } from '@/lib/date/localDate';
import {
  getProgressForVocabularies,
  submitVocabularyRating as submitRatingViaRpc,
  type SrsRating as ProgressSrsRating,
  type RatingResult,
} from './progressService';

// Base localStorage keys (will be scoped per user)
// Phase 2E: LOCAL_VOCABS_KEY and DELETED_VOCABS_KEY are now INACTIVE (legacy only)
const LOCAL_VOCABS_KEY = 'vocab_local_vocabularies_v1'; // INACTIVE after Phase 2E
const LOCAL_PROGRESS_KEY = 'vocab_local_progress_v1'; // INACTIVE after Phase 5
const LOCAL_STUDY_DATES_KEY = 'vocab_study_dates_v1';

const DELETED_VOCABS_KEY = 'vocab_deleted_vocabs_v1'; // INACTIVE after Phase 2E

// Phase 5: Collections, Topics, and Vocabularies in Supabase
// Study/SRS progress migrated to Supabase (user_vocab_progress table)
// Rating submissions go through atomic RPC (submit_vocabulary_rating)
// Legacy localStorage progress keys (vocab_local_progress_v1:<user-id>) are no longer written

/**
 * Get authenticated user ID from Supabase.
 * An unavailable session is a load error, not an empty vocabulary result.
 */
async function getAuthUserId(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('AUTH_REQUIRED');
    return user.id;
  } catch (err) {
    console.warn('getAuthUserId error:', err);
    throw err instanceof Error ? err : new Error('AUTH_REQUIRED');
  }
}

// Legacy helpers (deprecated, keep for DELETED_* keys only)
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

// Helper to safely retrieve Supabase client if configured
function getSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  return supabase;
}

// --- COLLECTION METHODS (Phase 2C: Migrated to Supabase) ---

/**
 * Get all collections from Supabase.
 * Collection totals are composed by the page loader from the same snapshot
 * as topics and vocabularies, avoiding a second nested fetch during restore.
 * Phase 2E: Collections, Topics, and Vocabularies in Supabase
 */
export async function getCollections(): Promise<Collection[]> {
  try {
    return await getCollectionsFromSupabase();
  } catch (err) {
    console.error('getCollections error:', err);
    throw err;
  }
}

/**
 * Create a new collection in Supabase
 * Database generates UUID, no client-side ID generation
 */
export async function addCollection(newCol: Omit<Collection, 'id'>): Promise<Collection> {
  try {
    const created = await createCollectionInSupabase(newCol);
    return {
      ...created,
      total_topics: 0,
      total_words: 0,
    };
  } catch (err) {
    console.error('addCollection error:', err);
    throw err;
  }
}

/**
 * Update an existing collection in Supabase
 */
export async function updateCollection(colId: string, updates: Partial<Collection>): Promise<void> {
  try {
    await updateCollectionInSupabase(colId, updates);
  } catch (err) {
    console.error('updateCollection error:', err);
    throw err;
  }
}

/**
 * Delete a collection from Supabase
 * Phase 2E: Blocks deletion if Collection has any Topics in Supabase
 */
export async function deleteCollection(colId: string): Promise<void> {
  try {
    // Check for Supabase Topics belonging to this Collection
    const allTopics = await getTopics(colId);

    if (allTopics.length > 0) {
      throw new CollectionHasChildrenError();
    }

    await deleteCollectionInSupabase(colId);
  } catch (err) {
    console.error('deleteCollection error:', err);
    throw err;
  }
}

// --- TOPIC / SECTION METHODS (Phase 2D: Migrated to Supabase) ---

export async function getTopics(collectionId?: string): Promise<Topic[]> {
  try {
    return await getTopicsFromSupabase(collectionId);
  } catch (err) {
    console.error('getTopics error:', err);
    throw err;
  }
}

export async function addTopic(newTopic: Omit<Topic, 'id'>): Promise<Topic> {
  try {
    return await createTopicInSupabase(newTopic);
  } catch (err) {
    console.error('addTopic error:', err);
    throw err;
  }
}

export async function updateTopic(topicId: string, updates: Partial<Topic>): Promise<void> {
  try {
    await updateTopicInSupabase(topicId, updates);
  } catch (err) {
    console.error('updateTopic error:', err);
    throw err;
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  try {
    await deleteTopicInSupabase(topicId);
  } catch (err) {
    console.error('deleteTopic error:', err);
    throw err;
  }
}

// --- VOCABULARY METHODS (Phase 2E: Migrated to Supabase) ---

/**
 * Get vocabularies from Supabase with merged study/SRS progress from Supabase
 * Phase 5: Vocabulary domain data from Supabase, progress from Supabase user_vocab_progress
 */
export async function getVocabByTopic(topicId?: string): Promise<Vocabulary[]> {
  await getAuthUserId();
  try {
    // Load vocabularies from Supabase
    const supabaseVocabs = await getVocabulariesFromSupabase(topicId);

    if (supabaseVocabs.length === 0) {
      return [];
    }

    // Load study progress from Supabase user_vocab_progress
    const vocabIds = supabaseVocabs.map((v) => v.id);
    const progressMap = await getProgressForVocabularies(vocabIds);

    // Merge Supabase vocabulary data with Supabase progress
    return supabaseVocabs.map((v) => {
      const prog = progressMap.get(v.id);
      const againCount = prog?.again_count || 0;
      return {
        ...v,
        status: (prog?.status as LearningStatus) || 'new',
        review_count: prog?.review_count || 0,
        last_reviewed_at: prog?.last_reviewed_at || undefined,
        next_review_at: prog?.next_review_at || undefined,
        interval_hours: prog?.interval_hours || undefined,
        again_count: againCount,
        is_difficult: againCount >= 5,
      };
    });
  } catch (err) {
    console.error('getVocabByTopic error:', err);
    throw err;
  }
}

/**
 * Create a vocabulary in Supabase
 * Phase 2E: Delegates to vocabularyService
 */
export async function addVocabulary(newVocab: Omit<Vocabulary, 'id'>): Promise<Vocabulary> {
  try {
    return await createVocabularyInSupabase(newVocab);
  } catch (err) {
    console.error('addVocabulary error:', err);
    throw err;
  }
}

/**
 * Bulk create vocabularies in Supabase
 * Phase 2E: Delegates to vocabularyService
 */
export async function bulkAddVocabularies(items: Omit<Vocabulary, 'id'>[]): Promise<Vocabulary[]> {
  try {
    return await bulkCreateVocabulariesInSupabase(items);
  } catch (err) {
    console.error('bulkAddVocabularies error:', err);
    throw err;
  }
}

/**
 * Update a vocabulary in Supabase
 * Phase 2E: Delegates to vocabularyService
 */
export async function updateVocabulary(vocabId: string, updates: Partial<Vocabulary>): Promise<void> {
  try {
    await updateVocabularyInSupabase(vocabId, updates);
  } catch (err) {
    console.error('updateVocabulary error:', err);
    throw err;
  }
}

/**
 * Delete a vocabulary from Supabase
 * Phase 5: After confirmed database deletion, Supabase CASCADE handles progress cleanup
 */
export async function deleteVocabulary(vocabId: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  try {
    // Delete from Supabase (CASCADE to user_vocab_progress via FK)
    await deleteVocabularyInSupabase(vocabId);
  } catch (err) {
    console.error('deleteVocabulary error:', err);
    throw err;
  }
}

// --- USER PROGRESS & STATS METHODS ---

export type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';

export async function updateUserProgress(
  vocabId: string,
  status: LearningStatus,
  rating?: SrsRating,
  idempotencyKey: string = crypto.randomUUID()
): Promise<RatingResult> {
  // Phase 5: Submit rating via atomic Supabase RPC
  // Server calculates schedule, updates progress, and inserts review log atomically
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const effectiveRating: ProgressSrsRating = rating || (status === 'mastered' ? 'mastered' : 'good');

  try {
    // Submit rating via RPC - server handles all scheduling logic
    const ratingResult = await submitRatingViaRpc(vocabId, effectiveRating, idempotencyKey);

    // Phase 7: No longer update localStorage study dates
    // Dashboard now queries review_logs directly for streak calculation.
    // The caller owns this key for the full logical action, including retries.
    return ratingResult;
  } catch (err) {
    console.error('updateUserProgress error:', err);
    throw err;
  }
}

function calculateStreak(studyDatesSet: Set<string>): number {
  return getConsecutiveLocalStreak(studyDatesSet);
}

export async function getStudyStats(): Promise<StudyStats> {
  // Phase 7: Stats are now computed in dashboardService from Supabase
  // This function kept for backward compatibility but should be replaced
  // with getDashboardMetrics() calls in components
  const userId = await getAuthUserId();
  if (!userId) {
    console.warn('getStudyStats: No authenticated user, returning empty stats');
    return {
      totalWords: 0,
      masteredCount: 0,
      learningCount: 0,
      newCount: 0,
      dailyStreak: 0,
      todayStudiedCount: 0,
    };
  }

  const allVocabs = await getVocabByTopic();
  const totalWords = allVocabs.length;

  let masteredCount = 0;
  let learningCount = 0;

  allVocabs.forEach((v) => {
    if (v.status === 'mastered') masteredCount++;
    else if (v.status === 'learning') learningCount++;
  });

  // Phase 7: Return minimal stats for backward compatibility
  // Real Dashboard metrics now come from dashboardService.getDashboardMetrics()
  return {
    totalWords,
    masteredCount,
    learningCount,
    newCount: Math.max(0, totalWords - (masteredCount + learningCount)),
    dailyStreak: 0, // Phase 7: Replaced by dashboardService
    todayStudiedCount: 0, // Phase 7: Replaced by dashboardService
  };
}

export async function resetAllProgress(): Promise<void> {
  // Phase 5: Reset all progress via progressService
  const userId = await getAuthUserId();
  if (!userId) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const { resetAllProgress: resetAllProgressInSupabase } = await import('./progressService');
  await resetAllProgressInSupabase();
}

