/**
 * Vocabulary Service - Supabase CRUD
 *
 * Handles all Vocabulary operations with Supabase as the source of truth.
 * Uses browser client with authenticated session and RLS enforcement.
 *
 * Phase 2E: Vocabularies migrated to Supabase
 * Study/SRS progress remains in user-scoped localStorage
 *
 * Data Ownership After Phase 2E:
 * - Collections: Supabase (Phase 2C)
 * - Topics: Supabase (Phase 2D)
 * - Vocabularies: Supabase (Phase 2E)
 * - Study/SRS data: user-scoped localStorage
 */

import { createClient } from '@/lib/supabase/client';
import { Vocabulary, PartOfSpeech } from '@/lib/types';
import { VocabularyValidationError } from './vocabularyErrors';

/**
 * Get all vocabularies for the authenticated user
 * RLS enforces user_id = auth.uid()
 *
 * @param topicId - Optional topic filter ('all' loads all user vocabularies)
 * @returns Array of Vocabularies from Supabase
 */
export async function getVocabularies(topicId?: string): Promise<Vocabulary[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication required for getVocabularies');
      return [];
    }

    let query = supabase
      .from('vocabularies')
      .select('id, topic_id, user_id, word, phonetic_uk, phonetic_us, part_of_speech, meaning, example, example_translation, synonyms, collocations, audio_url, note, created_at, updated_at')
      .order('created_at', { ascending: true });

    // Apply topic filter if provided and not 'all'
    if (topicId && topicId !== 'all') {
      query = query.eq('topic_id', topicId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase getVocabularies error:', error.message);
      throw new Error('Không thể tải từ vựng. Vui lòng thử lại.');
    }

    return data || [];
  } catch (err) {
    console.error('getVocabularies exception:', err);
    throw new Error('Không thể tải từ vựng. Vui lòng thử lại.');
  }
}

/**
 * Create a new vocabulary
 * Database generates UUID, user_id is set from auth.uid()
 *
 * @param payload - Vocabulary data without id
 * @returns Created Vocabulary with database-generated UUID
 */
export async function createVocabulary(
  payload: Omit<Vocabulary, 'id' | 'created_at' | 'updated_at'>
): Promise<Vocabulary> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Validate required fields
    const trimmedWord = payload.word.trim();
    const trimmedMeaning = payload.meaning.trim();

    if (!trimmedWord) {
      throw new VocabularyValidationError('Từ vựng không được để trống.');
    }

    if (!trimmedMeaning) {
      throw new VocabularyValidationError('Nghĩa không được để trống.');
    }

    if (!payload.topic_id) {
      throw new VocabularyValidationError('Vui lòng chọn học phần.');
    }

    const insertPayload = {
      user_id: user.id,
      topic_id: payload.topic_id,
      word: trimmedWord,
      phonetic_uk: payload.phonetic_uk?.trim() || null,
      phonetic_us: payload.phonetic_us?.trim() || null,
      part_of_speech: payload.part_of_speech || 'noun',
      meaning: trimmedMeaning,
      example: payload.example?.trim() || null,
      example_translation: payload.example_translation?.trim() || null,
      synonyms: payload.synonyms?.trim() || null,
      collocations: payload.collocations?.trim() || null,
      audio_url: payload.audio_url?.trim() || null,
      note: payload.note?.trim() || null,
    };

    const { data, error } = await supabase
      .from('vocabularies')
      .insert([insertPayload])
      .select('id, topic_id, user_id, word, phonetic_uk, phonetic_us, part_of_speech, meaning, example, example_translation, synonyms, collocations, audio_url, note, created_at, updated_at')
      .single();

    if (error) {
      console.error('Supabase createVocabulary error:', error.message, error.code);

      // Handle foreign key violation (invalid topic_id)
      if (error.code === '23503') {
        throw new VocabularyValidationError('Học phần không tồn tại hoặc bạn không có quyền truy cập.');
      }

      throw new Error('Không thể tạo từ vựng.');
    }

    if (!data) {
      throw new Error('Không thể tạo từ vựng.');
    }

    return data;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('createVocabulary exception:', err);
    throw new Error('Không thể tạo từ vựng.');
  }
}

/**
 * Bulk create vocabularies
 * Atomic batch insert - all succeed or all fail
 *
 * @param items - Array of vocabulary payloads without ids
 * @returns Array of created Vocabularies with database-generated UUIDs
 */
export async function bulkCreateVocabularies(
  items: Omit<Vocabulary, 'id' | 'created_at' | 'updated_at'>[]
): Promise<Vocabulary[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!items || items.length === 0) {
      return [];
    }

    // Validate all items before insertion
    const insertPayloads = items.map((item, index) => {
      const trimmedWord = item.word?.trim();
      const trimmedMeaning = item.meaning?.trim();

      if (!trimmedWord) {
        throw new VocabularyValidationError(`Hàng ${index + 1}: Từ vựng không được để trống.`);
      }

      if (!trimmedMeaning) {
        throw new VocabularyValidationError(`Hàng ${index + 1}: Nghĩa không được để trống.`);
      }

      if (!item.topic_id) {
        throw new VocabularyValidationError(`Hàng ${index + 1}: Vui lòng chọn học phần.`);
      }

      return {
        user_id: user.id,
        topic_id: item.topic_id,
        word: trimmedWord,
        phonetic_uk: item.phonetic_uk?.trim() || null,
        phonetic_us: item.phonetic_us?.trim() || null,
        part_of_speech: item.part_of_speech || 'noun',
        meaning: trimmedMeaning,
        example: item.example?.trim() || null,
        example_translation: item.example_translation?.trim() || null,
        synonyms: item.synonyms?.trim() || null,
        collocations: item.collocations?.trim() || null,
        audio_url: item.audio_url?.trim() || null,
        note: item.note?.trim() || null,
      };
    });

    // Atomic batch insert
    const { data, error } = await supabase
      .from('vocabularies')
      .insert(insertPayloads)
      .select('id, topic_id, user_id, word, phonetic_uk, phonetic_us, part_of_speech, meaning, example, example_translation, synonyms, collocations, audio_url, note, created_at, updated_at');

    if (error) {
      console.error('Supabase bulkCreateVocabularies error:', error.message, error.code);

      // Handle foreign key violation
      if (error.code === '23503') {
        throw new VocabularyValidationError('Một số học phần không tồn tại hoặc bạn không có quyền truy cập.');
      }

      throw new Error('Không thể nhập danh sách từ vựng.');
    }

    return data || [];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('bulkCreateVocabularies exception:', err);
    throw new Error('Không thể nhập danh sách từ vựng.');
  }
}

/**
 * Update an existing vocabulary
 * RLS enforces user can only update their own vocabularies
 *
 * Allowed updates: word, phonetic_uk, phonetic_us, part_of_speech, meaning,
 *                  example, example_translation, synonyms, collocations,
 *                  audio_url, note
 * Blocked updates: user_id, topic_id, created_at
 *
 * @param vocabularyId - Vocabulary UUID
 * @param updates - Partial Vocabulary data
 */
export async function updateVocabulary(
  vocabularyId: string,
  updates: Partial<Pick<Vocabulary, 'word' | 'phonetic_uk' | 'phonetic_us' | 'part_of_speech' | 'meaning' | 'example' | 'example_translation' | 'synonyms' | 'collocations' | 'audio_url' | 'note'>>
): Promise<void> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const updatePayload: Record<string, any> = {};

    if (updates.word !== undefined) {
      const trimmedWord = updates.word.trim();
      if (!trimmedWord) {
        throw new VocabularyValidationError('Từ vựng không được để trống.');
      }
      updatePayload.word = trimmedWord;
    }

    if (updates.meaning !== undefined) {
      const trimmedMeaning = updates.meaning.trim();
      if (!trimmedMeaning) {
        throw new VocabularyValidationError('Nghĩa không được để trống.');
      }
      updatePayload.meaning = trimmedMeaning;
    }

    if (updates.phonetic_uk !== undefined) {
      updatePayload.phonetic_uk = updates.phonetic_uk.trim() || null;
    }

    if (updates.phonetic_us !== undefined) {
      updatePayload.phonetic_us = updates.phonetic_us.trim() || null;
    }

    if (updates.part_of_speech !== undefined) {
      updatePayload.part_of_speech = updates.part_of_speech || 'noun';
    }

    if (updates.example !== undefined) {
      updatePayload.example = updates.example.trim() || null;
    }

    if (updates.example_translation !== undefined) {
      updatePayload.example_translation = updates.example_translation.trim() || null;
    }

    if (updates.synonyms !== undefined) {
      updatePayload.synonyms = updates.synonyms.trim() || null;
    }

    if (updates.collocations !== undefined) {
      updatePayload.collocations = updates.collocations.trim() || null;
    }

    if (updates.audio_url !== undefined) {
      updatePayload.audio_url = updates.audio_url.trim() || null;
    }

    if (updates.note !== undefined) {
      updatePayload.note = updates.note.trim() || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return; // No updates to apply
    }

    const { data, error } = await supabase
      .from('vocabularies')
      .update(updatePayload)
      .eq('id', vocabularyId)
      .select('id');

    if (error) {
      console.error('Supabase updateVocabulary error:', error.message);
      throw new Error('Không thể cập nhật từ vựng.');
    }

    // Verify update affected a row
    if (!data || data.length === 0) {
      throw new Error('Không tìm thấy từ vựng hoặc bạn không có quyền cập nhật.');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('updateVocabulary exception:', err);
    throw new Error('Không thể cập nhật từ vựng.');
  }
}

/**
 * Delete a vocabulary
 * RLS enforces user can only delete their own vocabularies
 *
 * Phase 2E Safety: After confirmed database deletion, cleans current-user
 * local study/progress references for this Vocabulary UUID
 *
 * @param vocabularyId - Vocabulary UUID
 * @returns Deleted vocabulary ID for progress cleanup
 */
export async function deleteVocabulary(vocabularyId: string): Promise<string> {
  const supabase = createClient();

  try {
    // Step 1: Get authenticated user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Step 2: Execute Supabase DELETE
    const { data, error } = await supabase
      .from('vocabularies')
      .delete()
      .eq('id', vocabularyId)
      .select('id');

    // Handle database errors
    if (error) {
      console.error('Supabase deleteVocabulary error:', error.message);
      throw new Error('Không thể xóa từ vựng.');
    }

    // Step 3: Verify at least one row was deleted
    if (!data || data.length === 0) {
      throw new Error('Không tìm thấy từ vựng hoặc bạn không có quyền xóa.');
    }

    // Step 4: Return deleted ID for progress cleanup in vocabService
    return vocabularyId;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('deleteVocabulary exception:', err);
    throw new Error('Không thể xóa từ vựng.');
  }
}
