import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Collection, Topic, Vocabulary, UserVocabProgress, StudyStats, LearningStatus } from '../lib/types';
import { INITIAL_COLLECTIONS, INITIAL_TOPICS, INITIAL_VOCABULARIES } from '../lib/initialData';
import {
  getCollections as getCollectionsFromSupabase,
  createCollection as createCollectionInSupabase,
  updateCollection as updateCollectionInSupabase,
  deleteCollection as deleteCollectionInSupabase,
} from './collectionService';
import { CollectionHasChildrenError } from './collectionErrors';

// LocalStorage keys for offline / missing table fallback
const LOCAL_TOPICS_KEY = 'vocab_local_topics_v1';
const LOCAL_VOCABS_KEY = 'vocab_local_vocabularies_v1';
const LOCAL_PROGRESS_KEY = 'vocab_local_progress_v1';
const LOCAL_STUDY_DATES_KEY = 'vocab_study_dates_v1';

const DELETED_TOPICS_KEY = 'vocab_deleted_topics_v1';
const DELETED_VOCABS_KEY = 'vocab_deleted_vocabs_v1';

// Phase 2C: Collections migrated to Supabase
// Topics and Vocabularies remain in localStorage (Phase 2D, 2E)
// localStorage is no longer used for Collections

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
 * Get all collections from Supabase with computed totals from localStorage Topics/Vocabularies
 * Phase 2C: Collections in Supabase, Topics/Vocabularies still in localStorage
 */
export async function getCollections(): Promise<Collection[]> {
  try {
    const collections = await getCollectionsFromSupabase();

    // Compute totals from localStorage Topics/Vocabularies (still unmigrated)
    const allTopics = await getTopics();
    const allVocabs = await getVocabByTopic();

    return collections.map((col) => {
      const colTopics = allTopics.filter((t) => t.collection_id === col.id);
      const colTopicIds = new Set(colTopics.map((t) => t.id));
      const colVocabs = allVocabs.filter((v) => colTopicIds.has(v.topic_id));

      return {
        ...col,
        total_topics: colTopics.length,
        total_words: colVocabs.length,
      };
    });
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
 * Phase 2C: Blocks deletion if Collection has any child Topics or Vocabularies in localStorage
 */
export async function deleteCollection(colId: string): Promise<void> {
  try {
    await deleteCollectionInSupabase(colId);
  } catch (err) {
    console.error('deleteCollection error:', err);
    throw err;
  }
}

// --- TOPIC / SECTION METHODS ---

export async function getTopics(collectionId?: string): Promise<Topic[]> {
  const client = getSupabase();
  let dbTopics: Topic[] = [];

  if (client) {
    try {
      let query = client.from('topics').select('*').order('created_at', { ascending: true });
      if (collectionId && collectionId !== 'all') {
        query = query.eq('collection_id', collectionId);
      }

      const { data, error } = await query;
      if (!error && data) {
        dbTopics = data;
      }
    } catch (err) {
      console.warn('Supabase getTopics error:', err);
    }
  }

  const baseTopics = client ? dbTopics : (dbTopics.length > 0 ? dbTopics : INITIAL_TOPICS);
  const localTopics = getLocalItem<Topic[]>(LOCAL_TOPICS_KEY, []);

  const topicMap = new Map<string, Topic>();
  baseTopics.forEach((t) => topicMap.set(t.id, t));
  localTopics.forEach((t) => topicMap.set(t.id, t));

  const deletedTopics = getLocalItem<string[]>(DELETED_TOPICS_KEY, []);

  // Phase 2C: Collections are in Supabase now, don't filter by deleted localStorage collections
  let mergedTopics = Array.from(topicMap.values()).filter(
    (t) => !deletedTopics.includes(t.id)
  );

  if (collectionId && collectionId !== 'all') {
    mergedTopics = mergedTopics.filter((t) => t.collection_id === collectionId);
  }

  const allVocabs = await getVocabByTopic();

  return mergedTopics.map((topic) => {
    const topicVocabs = allVocabs.filter((v) => v.topic_id === topic.id);
    const total = topicVocabs.length;
    const mastered = topicVocabs.filter((v) => v.status === 'mastered').length;
    const learning = topicVocabs.filter((v) => v.status === 'learning').length;

    return {
      ...topic,
      collection_id: topic.collection_id || undefined,
      total_words: total,
      mastered_words: mastered,
      learning_words: learning,
    };
  });
}

export async function addTopic(newTopic: Omit<Topic, 'id'>): Promise<Topic> {
  const topicId = 'topic-' + Date.now();
  const collectionId = newTopic.collection_id || undefined;
  const payload = {
    id: topicId,
    collection_id: collectionId || null,
    title: newTopic.title,
    description: newTopic.description || '',
    icon: newTopic.icon || 'BookOpen',
    category: newTopic.category || 'General',
  };

  const createdItem: Topic = {
    id: topicId,
    collection_id: collectionId,
    title: newTopic.title,
    description: newTopic.description || '',
    icon: newTopic.icon || 'BookOpen',
    category: newTopic.category || 'General',
    created_at: new Date().toISOString(),
    total_words: 0,
    mastered_words: 0,
    learning_words: 0,
  };

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('topics').insert([payload]);
      if (error) {
        console.warn('Note on Supabase addTopic insert:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on addTopic:', err);
  }

  const localTopics = getLocalItem<Topic[]>(LOCAL_TOPICS_KEY, []);
  if (!localTopics.some((t) => t.id === topicId)) {
    localTopics.push(createdItem);
    setLocalItem(LOCAL_TOPICS_KEY, localTopics);
  }

  return createdItem;
}

export async function updateTopic(topicId: string, updates: Partial<Topic>): Promise<void> {
  const localTopics = getLocalItem<Topic[]>(LOCAL_TOPICS_KEY, []);
  const updatedLocal = localTopics.map((t) => (t.id === topicId ? { ...t, ...updates } : t));
  setLocalItem(LOCAL_TOPICS_KEY, updatedLocal);

  try {
    const client = getSupabase();
    if (client) {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) updatePayload.title = updates.title;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.icon !== undefined) updatePayload.icon = updates.icon;
      if (updates.category !== undefined) updatePayload.category = updates.category;
      if (updates.collection_id !== undefined) updatePayload.collection_id = updates.collection_id;

      const { error } = await client.from('topics').update(updatePayload).eq('id', topicId);
      if (error) {
        console.warn('Note on Supabase updateTopic:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on updateTopic:', err);
  }
}

export async function deleteTopic(topicId: string): Promise<void> {
  const deletedTopics = getLocalItem<string[]>(DELETED_TOPICS_KEY, []);
  if (!deletedTopics.includes(topicId)) {
    deletedTopics.push(topicId);
    setLocalItem(DELETED_TOPICS_KEY, deletedTopics);
  }

  const localTopics = getLocalItem<Topic[]>(LOCAL_TOPICS_KEY, []);
  setLocalItem(LOCAL_TOPICS_KEY, localTopics.filter((t) => t.id !== topicId));

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('topics').delete().eq('id', topicId);
      if (error) {
        console.warn('Note on Supabase deleteTopic:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on deleteTopic:', err);
  }
}

// --- VOCABULARY METHODS ---

export async function getVocabByTopic(topicId?: string): Promise<Vocabulary[]> {
  const client = getSupabase();
  let dbVocabs: Vocabulary[] = [];
  let progressMap: Record<string, UserVocabProgress> = {};

  if (client) {
    try {
      let query = client.from('vocabularies').select('*').order('created_at', { ascending: true });
      if (topicId && topicId !== 'all') {
        query = query.eq('topic_id', topicId);
      }

      const { data: vocabData, error: vocabErr } = await query;
      if (!vocabErr && vocabData) {
        dbVocabs = vocabData;
      }

      const { data: progressData } = await client.from('user_vocab_progress').select('*');
      if (progressData) {
        progressData.forEach((p) => {
          progressMap[p.vocabulary_id] = p;
        });
      }
    } catch (err) {
      console.warn('Supabase getVocabByTopic error:', err);
    }
  }

  const localProgress = getLocalItem<Record<string, Partial<UserVocabProgress>>>(LOCAL_PROGRESS_KEY, {});

  const baseVocabs = client ? dbVocabs : (dbVocabs.length > 0 ? dbVocabs : INITIAL_VOCABULARIES);
  const localVocabs = getLocalItem<Vocabulary[]>(LOCAL_VOCABS_KEY, []);

  const vocabMap = new Map<string, Vocabulary>();
  baseVocabs.forEach((v) => vocabMap.set(v.id, v));
  localVocabs.forEach((v) => vocabMap.set(v.id, v));

  const deletedVocabs = getLocalItem<string[]>(DELETED_VOCABS_KEY, []);
  const deletedTopics = getLocalItem<string[]>(DELETED_TOPICS_KEY, []);

  let mergedVocabs = Array.from(vocabMap.values()).filter(
    (v) => !deletedVocabs.includes(v.id) && (!v.topic_id || !deletedTopics.includes(v.topic_id))
  );

  if (topicId && topicId !== 'all') {
    mergedVocabs = mergedVocabs.filter((v) => v.topic_id === topicId);
  }

  return mergedVocabs.map((v) => {
    const prog = progressMap[v.id] || localProgress[v.id];
    const againCount = prog?.again_count || 0;
    return {
      ...v,
      status: (prog?.status as LearningStatus) || v.status || 'new',
      review_count: prog?.review_count || v.review_count || 0,
      last_reviewed_at: prog?.last_reviewed_at || v.last_reviewed_at,
      next_review_at: prog?.next_review_at || v.next_review_at,
      interval_hours: prog?.interval_hours || v.interval_hours,
      again_count: againCount,
      is_difficult: againCount >= 5,
    };
  });
}

export async function addVocabulary(newVocab: Omit<Vocabulary, 'id'>): Promise<Vocabulary> {
  const vocabId = 'vocab-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const payload = {
    id: vocabId,
    topic_id: newVocab.topic_id,
    word: newVocab.word,
    phonetic_uk: newVocab.phonetic_uk || '',
    phonetic_us: newVocab.phonetic_us || '',
    part_of_speech: newVocab.part_of_speech || 'noun',
    meaning: newVocab.meaning,
    example: newVocab.example || '',
    example_translation: newVocab.example_translation || '',
    synonyms: newVocab.synonyms || '',
    collocations: newVocab.collocations || '',
    note: newVocab.note || '',
  };

  const createdItem: Vocabulary = {
    ...payload,
    created_at: new Date().toISOString(),
    status: 'new',
    review_count: 0,
  };

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('vocabularies').insert([payload]);
      if (error) {
        console.error('Supabase addVocabulary error:', error.message || error, error.code ? `(Code: ${error.code})` : '');
      }
    }
  } catch (err) {
    console.error('Supabase notice on addVocabulary:', err);
  }

  const localVocabs = getLocalItem<Vocabulary[]>(LOCAL_VOCABS_KEY, []);
  if (!localVocabs.some((v) => v.id === vocabId)) {
    localVocabs.push(createdItem);
    setLocalItem(LOCAL_VOCABS_KEY, localVocabs);
  }

  return createdItem;
}

export async function bulkAddVocabularies(items: Omit<Vocabulary, 'id'>[]): Promise<Vocabulary[]> {
  const createdList: Vocabulary[] = [];
  const dbPayloads: any[] = [];

  items.forEach((item, index) => {
    const vocabId = 'vocab-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substring(2, 6);
    const payload = {
      id: vocabId,
      topic_id: item.topic_id,
      word: item.word,
      phonetic_uk: item.phonetic_uk || '',
      phonetic_us: item.phonetic_us || '',
      part_of_speech: item.part_of_speech || 'noun',
      meaning: item.meaning,
      example: item.example || '',
      example_translation: item.example_translation || '',
      synonyms: item.synonyms || '',
      collocations: item.collocations || '',
      note: item.note || '',
    };
    dbPayloads.push(payload);
    createdList.push({
      ...payload,
      created_at: new Date().toISOString(),
      status: 'new',
      review_count: 0,
    });
  });

  if (dbPayloads.length > 0) {
    try {
      const client = getSupabase();
      if (client) {
        const { error } = await client.from('vocabularies').insert(dbPayloads);
        if (error) {
          console.error('Supabase bulk insert error:', error.message || error, error.code ? `(Code: ${error.code})` : '');
        }
      }
    } catch (err) {
      console.error('Supabase notice on bulkAddVocabularies:', err);
    }
  }

  const localVocabs = getLocalItem<Vocabulary[]>(LOCAL_VOCABS_KEY, []);
  createdList.forEach((item) => {
    if (!localVocabs.some((v) => v.id === item.id)) {
      localVocabs.push(item);
    }
  });
  setLocalItem(LOCAL_VOCABS_KEY, localVocabs);

  return createdList;
}

export async function updateVocabulary(vocabId: string, updates: Partial<Vocabulary>): Promise<void> {
  const localVocabs = getLocalItem<Vocabulary[]>(LOCAL_VOCABS_KEY, []);
  const updatedLocal = localVocabs.map((v) => (v.id === vocabId ? { ...v, ...updates } : v));
  setLocalItem(LOCAL_VOCABS_KEY, updatedLocal);

  try {
    const client = getSupabase();
    if (client) {
      const updatePayload: Record<string, any> = {};
      if (updates.word !== undefined) updatePayload.word = updates.word;
      if (updates.phonetic_uk !== undefined) updatePayload.phonetic_uk = updates.phonetic_uk;
      if (updates.phonetic_us !== undefined) updatePayload.phonetic_us = updates.phonetic_us;
      if (updates.part_of_speech !== undefined) updatePayload.part_of_speech = updates.part_of_speech;
      if (updates.meaning !== undefined) updatePayload.meaning = updates.meaning;
      if (updates.example !== undefined) updatePayload.example = updates.example;
      if (updates.example_translation !== undefined) updatePayload.example_translation = updates.example_translation;
      if (updates.synonyms !== undefined) updatePayload.synonyms = updates.synonyms;
      if (updates.collocations !== undefined) updatePayload.collocations = updates.collocations;
      if (updates.note !== undefined) updatePayload.note = updates.note;
      if (updates.topic_id !== undefined) updatePayload.topic_id = updates.topic_id;

      const { error } = await client.from('vocabularies').update(updatePayload).eq('id', vocabId);
      if (error) {
        console.warn('Note on Supabase updateVocabulary:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on updateVocabulary:', err);
  }
}

export async function deleteVocabulary(vocabId: string): Promise<void> {
  const deletedVocabs = getLocalItem<string[]>(DELETED_VOCABS_KEY, []);
  if (!deletedVocabs.includes(vocabId)) {
    deletedVocabs.push(vocabId);
    setLocalItem(DELETED_VOCABS_KEY, deletedVocabs);
  }

  const localVocabs = getLocalItem<Vocabulary[]>(LOCAL_VOCABS_KEY, []);
  setLocalItem(LOCAL_VOCABS_KEY, localVocabs.filter((v) => v.id !== vocabId));

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('vocabularies').delete().eq('id', vocabId);
      if (error) {
        console.warn('Note on Supabase deleteVocabulary:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on deleteVocabulary:', err);
  }
}

// --- USER PROGRESS & STATS METHODS ---

export type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';

export async function updateUserProgress(
  vocabId: string,
  status: LearningStatus,
  rating?: SrsRating
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  let existingData: any = null;

  try {
    const client = getSupabase();
    if (client) {
      const { data } = await client
        .from('user_vocab_progress')
        .select('*')
        .eq('vocabulary_id', vocabId)
        .maybeSingle();
      existingData = data;
    }
  } catch (err) {
    console.warn('Supabase notice on fetch progress:', err);
  }

  const localProgress = getLocalItem<Record<string, any>>(LOCAL_PROGRESS_KEY, {});
  if (!existingData && localProgress[vocabId]) {
    existingData = localProgress[vocabId];
  }

  const currentCount = existingData?.review_count || 0;
  const currentIntervalHours = existingData?.interval_hours || 0;
  let currentAgainCount = existingData?.again_count || 0;

  let nextReviewIso: string | undefined = undefined;
  let newIntervalHours = currentIntervalHours;
  let newStatus: LearningStatus = status;

  if (status === 'mastered' || rating === 'mastered') {
    newStatus = 'mastered';
    nextReviewIso = undefined;
  } else if (rating === 'again') {
    newStatus = 'learning';
    currentAgainCount += 1;
    newIntervalHours = 0.0833; // 5 phút (5 từ tiếp theo)
    nextReviewIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  } else if (rating === 'hard') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 2 : 6;
    nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
  } else if (rating === 'good') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 3 : 24;
    nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
  } else if (rating === 'easy') {
    newStatus = 'learning';
    newIntervalHours = currentIntervalHours > 0 ? currentIntervalHours * 4 : 72;
    nextReviewIso = new Date(now.getTime() + newIntervalHours * 3600 * 1000).toISOString();
  } else {
    if (newStatus === 'learning' && !existingData?.next_review_at) {
      newIntervalHours = 24;
      nextReviewIso = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    }
  }

  const upsertPayload: Record<string, any> = {
    vocabulary_id: vocabId,
    status: newStatus,
    review_count: currentCount + 1,
    last_reviewed_at: nowIso,
    next_review_at: nextReviewIso,
    interval_hours: newIntervalHours,
    again_count: currentAgainCount,
  };

  localProgress[vocabId] = upsertPayload;
  setLocalItem(LOCAL_PROGRESS_KEY, localProgress);

  // Record today in study dates history for streak calculation
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const studyDates = getLocalItem<string[]>(LOCAL_STUDY_DATES_KEY, []);
  if (!studyDates.includes(todayDateStr)) {
    studyDates.push(todayDateStr);
    setLocalItem(LOCAL_STUDY_DATES_KEY, studyDates);
  }

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client
        .from('user_vocab_progress')
        .upsert(upsertPayload, { onConflict: 'vocabulary_id' });

      if (error) {
        console.warn('Note on Supabase progress upsert:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on progress upsert:', err);
  }
}

function calculateStreak(studyDatesSet: Set<string>): number {
  if (studyDatesSet.size === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  let checkDate = new Date();
  if (studyDatesSet.has(todayStr)) {
    checkDate = today;
  } else if (studyDatesSet.has(yesterdayStr)) {
    checkDate = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const dStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (studyDatesSet.has(dStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getStudyStats(): Promise<StudyStats> {
  const allVocabs = await getVocabByTopic();
  const totalWords = allVocabs.length;

  let masteredCount = 0;
  let learningCount = 0;
  let todayStudiedCount = 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const storedDates = getLocalItem<string[]>(LOCAL_STUDY_DATES_KEY, []);
  const studyDatesSet = new Set<string>(storedDates);

  allVocabs.forEach((v) => {
    if (v.status === 'mastered') masteredCount++;
    else if (v.status === 'learning') learningCount++;

    if (v.last_reviewed_at) {
      const d = new Date(v.last_reviewed_at);
      if (!isNaN(d.getTime())) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        studyDatesSet.add(dStr);
        if (dStr === todayStr) {
          todayStudiedCount++;
        }
      }
    }
  });

  const dailyStreak = calculateStreak(studyDatesSet);

  return {
    totalWords,
    masteredCount,
    learningCount,
    newCount: Math.max(0, totalWords - (masteredCount + learningCount)),
    dailyStreak,
    todayStudiedCount,
    lastStudyDate: todayStr,
  };
}

export async function resetAllProgress(): Promise<void> {
  setLocalItem(LOCAL_PROGRESS_KEY, {});

  try {
    const client = getSupabase();
    if (client) {
      const { error } = await client.from('user_vocab_progress').delete().neq('vocabulary_id', '');
      if (error) {
        console.warn('Note on Supabase progress reset:', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase notice on resetAllProgress:', err);
  }
}

