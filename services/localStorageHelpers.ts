/**
 * User-Scoped localStorage Helpers
 *
 * Phase 2C Fix: Isolate Topics and Vocabularies per authenticated user
 * to prevent cross-user data leakage in shared browser environments.
 *
 * Storage Key Format:
 * - User-scoped: `vocab_local_topics_v1:<user-id>`
 * - User-scoped: `vocab_local_vocabs_v1:<user-id>`
 *
 * Legacy Keys (no longer read):
 * - `vocab_local_topics_v1` (global, unscoped)
 * - `vocab_local_vocabs_v1` (global, unscoped)
 *
 * Security:
 * - User ID must come from authenticated Supabase session only
 * - Never accept user ID from form input or client state
 * - Missing authentication must not read global fallback keys
 */

/**
 * Build user-scoped localStorage key
 * @param baseKey - Base key without user suffix (e.g., 'vocab_local_topics_v1')
 * @param userId - Authenticated user ID from Supabase auth.uid()
 * @returns User-scoped key (e.g., 'vocab_local_topics_v1:alice-uuid')
 */
export function getUserStorageKey(baseKey: string, userId: string): string {
  if (!userId || userId.trim() === '') {
    throw new Error('getUserStorageKey: userId is required');
  }
  return `${baseKey}:${userId}`;
}

/**
 * Safe localStorage reader with user scoping
 * Returns empty array if:
 * - Running server-side
 * - User ID is missing
 * - Key doesn't exist
 * - JSON parsing fails
 * - Result is not an array
 */
export function getUserScopedArray<T>(baseKey: string, userId: string | null | undefined): T[] {
  if (typeof window === 'undefined') return [];
  if (!userId) return [];

  try {
    const scopedKey = getUserStorageKey(baseKey, userId);
    const item = localStorage.getItem(scopedKey);
    if (!item) return [];

    const parsed = JSON.parse(item);
    if (!Array.isArray(parsed)) return [];

    return parsed as T[];
  } catch (err) {
    console.warn(`Failed to read user-scoped localStorage key "${baseKey}":`, err);
    return [];
  }
}

/**
 * Write to user-scoped localStorage
 */
export function setUserScopedArray<T>(baseKey: string, userId: string | null | undefined, value: T[]): void {
  if (typeof window === 'undefined') return;
  if (!userId) {
    console.warn(`setUserScopedArray: Cannot write to "${baseKey}" without authenticated user`);
    return;
  }

  try {
    const scopedKey = getUserStorageKey(baseKey, userId);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write user-scoped localStorage key "${baseKey}":`, err);
  }
}

/**
 * Read user-scoped object (e.g., progress map)
 */
export function getUserScopedObject<T extends Record<string, any>>(
  baseKey: string,
  userId: string | null | undefined,
  defaultValue: T
): T {
  if (typeof window === 'undefined') return defaultValue;
  if (!userId) return defaultValue;

  try {
    const scopedKey = getUserStorageKey(baseKey, userId);
    const item = localStorage.getItem(scopedKey);
    if (!item) return defaultValue;

    const parsed = JSON.parse(item);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return defaultValue;
    }

    return parsed as T;
  } catch (err) {
    console.warn(`Failed to read user-scoped object "${baseKey}":`, err);
    return defaultValue;
  }
}

/**
 * Write user-scoped object
 */
export function setUserScopedObject<T extends Record<string, any>>(
  baseKey: string,
  userId: string | null | undefined,
  value: T
): void {
  if (typeof window === 'undefined') return;
  if (!userId) {
    console.warn(`setUserScopedObject: Cannot write to "${baseKey}" without authenticated user`);
    return;
  }

  try {
    const scopedKey = getUserStorageKey(baseKey, userId);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write user-scoped object "${baseKey}":`, err);
  }
}
