/**
 * Topic Service - Supabase CRUD
 *
 * Handles all Topic operations with Supabase as the source of truth.
 * Uses browser client with authenticated session and RLS enforcement.
 *
 * Phase 2E: Topics in Supabase, Vocabularies in Supabase
 *
 * Data Ownership After Phase 2E:
 * - Collections: Supabase (Phase 2C)
 * - Topics: Supabase (Phase 2D)
 * - Vocabularies: Supabase (Phase 2E)
 * - Study/SRS data: user-scoped localStorage
 */

import { createClient } from '@/lib/supabase/client';
import { Topic } from '@/lib/types';
import { TopicHasVocabulariesError } from './topicErrors';

/**
 * Get all topics for the authenticated user
 * RLS enforces user_id = auth.uid()
 *
 * @param collectionId - Optional collection filter
 * @returns Array of Topics with computed vocabulary counts from Supabase
 */
export async function getTopics(collectionId?: string, authenticatedUserId?: string): Promise<Topic[]> {
  const supabase = createClient();

  try {
    if (!authenticatedUserId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required for getTopics');
        throw new Error('AUTH_REQUIRED');
      }
    }

    let query = supabase
      .from('topics')
      .select('id, collection_id, user_id, title, description, icon, category, created_at, updated_at')
      .order('created_at', { ascending: true });

    // Apply collection filter if provided
    if (collectionId && collectionId !== 'all') {
      query = query.eq('collection_id', collectionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase getTopics error:', error.message);
      throw new Error('Không thể tải học phần. Vui lòng thử lại.');
    }

    const topics = (data || []) as Topic[];

    // Compute vocabulary counts from Supabase
    // Use a single query to count vocabularies for all topics
    const topicIds = topics.map(t => t.id);

    if (topicIds.length === 0) {
      return topics.map(topic => ({
        ...topic,
        total_words: 0,
        mastered_words: 0,
        learning_words: 0,
      }));
    }

    const { data: vocabData, error: vocabError } = await supabase
      .from('vocabularies')
      .select('id, topic_id')
      .in('topic_id', topicIds);

    if (vocabError) {
      console.error('Supabase vocabulary count error:', vocabError.message);
      throw new Error('Unable to load vocabulary counts. Please try again.');
    }

    // Count vocabularies per topic
    const vocabCounts = new Map<string, number>();
    ((vocabData || []) as Array<{ topic_id: string }>).forEach(v => {
      vocabCounts.set(v.topic_id, (vocabCounts.get(v.topic_id) || 0) + 1);
    });

    return topics.map((topic) => {
      const total = vocabCounts.get(topic.id) || 0;

      return {
        ...topic,
        total_words: total,
        mastered_words: 0, // Progress computed separately in vocabService
        learning_words: 0, // Progress computed separately in vocabService
      };
    });
  } catch (err) {
    console.error('getTopics exception:', err);
    throw new Error('Không thể tải học phần. Vui lòng thử lại.');
  }
}

/**
 * Create a new topic
 * Database generates UUID, user_id is set from auth.uid()
 *
 * @param payload - Topic data without id
 * @returns Created Topic with database-generated UUID
 */
export async function createTopic(
  payload: Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'total_words' | 'mastered_words' | 'learning_words'>
): Promise<Topic> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) {
      throw new Error('Tên học phần không được để trống.');
    }

    if (!payload.collection_id) {
      throw new Error('Vui lòng chọn bộ sưu tập.');
    }

    const insertPayload = {
      user_id: user.id,
      collection_id: payload.collection_id,
      title: trimmedTitle,
      description: payload.description?.trim() || '',
      icon: 'BookOpen', // Fixed icon internally
      category: payload.category?.trim() || 'General',
    };

    const { data, error } = await supabase
      .from('topics')
      .insert([insertPayload])
      .select('id, collection_id, user_id, title, description, icon, category, created_at, updated_at')
      .single();

    if (error) {
      console.error('Supabase createTopic error:', error.message, error.code);
      throw new Error('Không thể tạo học phần.');
    }

    if (!data) {
      throw new Error('Không thể tạo học phần.');
    }

    return {
      ...data,
      total_words: 0,
      mastered_words: 0,
      learning_words: 0,
    };
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('createTopic exception:', err);
    throw new Error('Không thể tạo học phần.');
  }
}

/**
 * Update an existing topic
 * RLS enforces user can only update their own topics
 *
 * Allowed updates: title, description, category
 * Blocked updates: user_id, created_at
 * Collection change: Not supported in Phase 2D
 *
 * @param topicId - Topic UUID
 * @param updates - Partial Topic data
 */
export async function updateTopic(
  topicId: string,
  updates: Partial<Pick<Topic, 'title' | 'description' | 'category'>>
): Promise<void> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const updatePayload: Record<string, any> = {};

    if (updates.title !== undefined) {
      const trimmedTitle = updates.title.trim();
      if (!trimmedTitle) {
        throw new Error('Tên học phần không được để trống.');
      }
      updatePayload.title = trimmedTitle;
    }

    if (updates.description !== undefined) {
      updatePayload.description = updates.description.trim();
    }

    if (updates.category !== undefined) {
      updatePayload.category = updates.category.trim() || 'General';
    }

    if (Object.keys(updatePayload).length === 0) {
      return; // No updates to apply
    }

    const { data, error } = await supabase
      .from('topics')
      .update(updatePayload)
      .eq('id', topicId)
      .select('id');

    if (error) {
      console.error('Supabase updateTopic error:', error.message);
      throw new Error('Không thể cập nhật học phần.');
    }

    // Verify update affected a row
    if (!data || data.length === 0) {
      throw new Error('Không tìm thấy học phần hoặc bạn không có quyền cập nhật.');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('updateTopic exception:', err);
    throw new Error('Không thể cập nhật học phần.');
  }
}

/**
 * Delete a topic
 * RLS enforces user can only delete their own topics
 *
 * Phase 2E Safety: Blocks deletion if Topic has any Vocabularies in Supabase
 *
 * Safe deletion order:
 * 1. Get authenticated user ID
 * 2. Query Supabase Vocabularies belonging to this Topic
 * 3. Reject if any Vocabularies exist
 * 4. Execute Supabase DELETE with .select('id')
 * 5. Verify at least one row was deleted
 *
 * @param topicId - Topic UUID
 */
export async function deleteTopic(topicId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Step 1: Get authenticated user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Step 2: Query Supabase Vocabularies belonging to this Topic
    const { data: topicVocabs, error: vocabError } = await supabase
      .from('vocabularies')
      .select('id')
      .eq('topic_id', topicId)
      .limit(1);

    if (vocabError) {
      console.error('Supabase deleteTopic vocabulary check error:', vocabError.message);
      throw new Error('Không thể kiểm tra từ vựng trong học phần.');
    }

    // Step 3: Block deletion if any Vocabularies exist
    if (topicVocabs && topicVocabs.length > 0) {
      throw new TopicHasVocabulariesError();
    }

    // Step 4: Execute Supabase DELETE with .select('id') to verify row was deleted
    const { data, error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicId)
      .select('id');

    // Handle database errors
    if (error) {
      console.error('Supabase deleteTopic error:', error.message);
      throw new Error('Không thể xóa học phần.');
    }

    // Step 5: Verify at least one row was deleted
    if (!data || data.length === 0) {
      throw new Error('Không tìm thấy học phần hoặc bạn không có quyền xóa.');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('deleteTopic exception:', err);
    throw new Error('Không thể xóa học phần.');
  }
}
