/**
 * Collection Service - Supabase CRUD
 *
 * Handles all Collection operations with Supabase as the source of truth.
 * Uses browser client with authenticated session and RLS enforcement.
 *
 * Phase 2C: Collections migrated to Supabase
 * Topics and Vocabularies remain in localStorage (Phase 2D, 2E)
 */

import { createClient } from '@/lib/supabase/client';
import { Collection, Topic, Vocabulary } from '@/lib/types';
import { CollectionHasChildrenError } from './collectionErrors';

// LocalStorage keys (read-only during Phase 2C transitional period)
const LOCAL_TOPICS_KEY = 'vocab_local_topics_v1';
const LOCAL_VOCABS_KEY = 'vocab_local_vocabularies_v1';

/**
 * Safe localStorage reader for server-side and client-side environments
 * Returns empty array if:
 * - Running server-side
 * - Key doesn't exist
 * - JSON parsing fails
 * - Result is not an array
 */
function safeGetLocalStorageArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];

  try {
    const item = localStorage.getItem(key);
    if (!item) return [];

    const parsed = JSON.parse(item);
    if (!Array.isArray(parsed)) return [];

    return parsed as T[];
  } catch (err) {
    console.warn(`Failed to read localStorage key "${key}":`, err);
    return [];
  }
}

/**
 * Get all collections for the authenticated user
 * RLS enforces user_id = auth.uid()
 */
export async function getCollections(): Promise<Collection[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication required for getCollections');
      return [];
    }

    const { data, error } = await supabase
      .from('collections')
      .select('id, user_id, title, description, icon, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase getCollections error:', error.message);
      throw new Error('Không thể tải bộ sưu tập. Vui lòng thử lại.');
    }

    return data || [];
  } catch (err) {
    console.error('getCollections exception:', err);
    throw new Error('Không thể tải bộ sưu tập. Vui lòng thử lại.');
  }
}

/**
 * Create a new collection
 * Database generates UUID, user_id is set from auth.uid() via RLS
 */
export async function createCollection(
  payload: Omit<Collection, 'id' | 'created_at' | 'updated_at'>
): Promise<Collection> {
  const supabase = createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) {
      throw new Error('Tên bộ sưu tập không được để trống.');
    }

    const insertPayload = {
      user_id: user.id,
      title: trimmedTitle,
      description: payload.description?.trim() || '',
      icon: payload.icon || 'FolderKanban',
    };

    const { data, error } = await supabase
      .from('collections')
      .insert([insertPayload])
      .select('id, user_id, title, description, icon, created_at, updated_at')
      .single();

    if (error) {
      console.error('Supabase createCollection error:', error.message, error.code);
      throw new Error('Không thể tạo bộ sưu tập.');
    }

    if (!data) {
      throw new Error('Không thể tạo bộ sưu tập.');
    }

    return data;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('createCollection exception:', err);
    throw new Error('Không thể tạo bộ sưu tập.');
  }
}

/**
 * Update an existing collection
 * RLS enforces user can only update their own collections
 */
export async function updateCollection(
  collectionId: string,
  updates: Partial<Pick<Collection, 'title' | 'description' | 'icon'>>
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
        throw new Error('Tên bộ sưu tập không được để trống.');
      }
      updatePayload.title = trimmedTitle;
    }

    if (updates.description !== undefined) {
      updatePayload.description = updates.description.trim();
    }

    if (updates.icon !== undefined) {
      updatePayload.icon = updates.icon;
    }

    if (Object.keys(updatePayload).length === 0) {
      return; // No updates to apply
    }

    const { error } = await supabase
      .from('collections')
      .update(updatePayload)
      .eq('id', collectionId);

    if (error) {
      console.error('Supabase updateCollection error:', error.message);
      throw new Error('Không thể cập nhật bộ sưu tập.');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('updateCollection exception:', err);
    throw new Error('Không thể cập nhật bộ sưu tập.');
  }
}

/**
 * Delete a collection
 * RLS enforces user can only delete their own collections
 *
 * Phase 2C Safety: Blocks deletion if Collection has any child Topics or Vocabularies
 * in localStorage to prevent orphaned data during the transitional period.
 *
 * Safe deletion order:
 * 1. Validate collection ID
 * 2. Read local Topics belonging to this Collection
 * 3. Build Set of Topic IDs
 * 4. Read local Vocabularies belonging to those Topics
 * 5. Reject if any child Topics or Vocabularies exist
 * 6. Validate authenticated user
 * 7. Execute Supabase DELETE with .select('id')
 * 8. Verify at least one row was deleted
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Step 1 & 2: Read local Topics that belong to this Collection
    const localTopics = safeGetLocalStorageArray<Topic>(LOCAL_TOPICS_KEY);
    const childTopics = localTopics.filter((t) => t.collection_id === collectionId);

    // Step 3: Build Set of child Topic IDs
    const childTopicIds = new Set(childTopics.map((t) => t.id));

    // Step 4: Read local Vocabularies that belong to child Topics
    const localVocabs = safeGetLocalStorageArray<Vocabulary>(LOCAL_VOCABS_KEY);
    const childVocabs = localVocabs.filter((v) => childTopicIds.has(v.topic_id));

    // Step 5: Block deletion if any child Topics or Vocabularies exist
    if (childTopics.length > 0 || childVocabs.length > 0) {
      throw new CollectionHasChildrenError();
    }

    // Step 6: Validate authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Step 7: Execute Supabase DELETE with .select('id') to verify row was deleted
    const { data, error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .select('id');

    // Step 8: Handle database errors
    if (error) {
      console.error('Supabase deleteCollection error:', error.message);
      throw new Error('Không thể xóa bộ sưu tập.');
    }

    // Step 9: Verify at least one row was deleted
    if (!data || data.length === 0) {
      throw new Error('Không tìm thấy bộ sưu tập hoặc bạn không có quyền xóa.');
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    console.error('deleteCollection exception:', err);
    throw new Error('Không thể xóa bộ sưu tập.');
  }
}
