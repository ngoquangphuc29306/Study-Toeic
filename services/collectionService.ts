/**
 * Collection Service - Supabase CRUD
 *
 * Handles all Collection operations with Supabase as the source of truth.
 * Uses browser client with authenticated session and RLS enforcement.
 *
 * Phase 2E: Collections in Supabase, Vocabularies in Supabase
 *
 * Data Ownership After Phase 2E:
 * - Collections: Supabase (Phase 2C)
 * - Topics: Supabase (Phase 2D)
 * - Vocabularies: Supabase (Phase 2E)
 * - Study/SRS data: user-scoped localStorage
 */

import { createClient } from '@/lib/supabase/client';
import { Collection } from '@/lib/types';
import { CollectionHasChildrenError } from './collectionErrors';


/**
 * Get all collections for the authenticated user
 * RLS enforces user_id = auth.uid()
 */
export async function getCollections(authenticatedUserId?: string): Promise<Collection[]> {
  const supabase = createClient();

  try {
    if (!authenticatedUserId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required for getCollections');
        throw new Error('AUTH_REQUIRED');
      }
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
 * Phase 2E Safety: Blocks deletion if Collection has any Topics in Supabase
 * (Topics already block deletion if they have Vocabularies in Supabase)
 *
 * Safe deletion order:
 * 1. Get authenticated user ID
 * 2. Query Supabase Topics belonging to this Collection
 * 3. Reject if any Topics exist
 * 4. Execute Supabase DELETE with .select('id')
 * 5. Verify at least one row was deleted
 *
 * @param collectionId - Collection UUID
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Step 1: Get authenticated user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Step 2: Query Supabase Topics belonging to this Collection
    const { data: childTopics, error: topicError } = await supabase
      .from('topics')
      .select('id')
      .eq('collection_id', collectionId)
      .limit(1);

    if (topicError) {
      console.error('Supabase deleteCollection topic check error:', topicError.message);
      throw new Error('Không thể kiểm tra học phần trong bộ sưu tập.');
    }

    // Step 3: Block deletion if any Topics exist
    if (childTopics && childTopics.length > 0) {
      throw new CollectionHasChildrenError();
    }

    // Step 4: Execute Supabase DELETE with .select('id') to verify row was deleted
    const { data, error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .select('id');

    // Step 5: Handle database errors
    if (error) {
      console.error('Supabase deleteCollection error:', error.message);
      throw new Error('Không thể xóa bộ sưu tập.');
    }

    // Verify at least one row was deleted
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
