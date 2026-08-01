/**
 * Profile Service
 *
 * Handles user profile operations:
 * - Profile retrieval and creation
 * - Display name updates
 * - Avatar upload, replacement, and removal
 * - Signed URL generation for private avatar display
 *
 * Architecture:
 * - Uses browser client for auth state
 * - Profiles stored in public.profiles table
 * - Avatars stored in private Storage bucket 'avatars'
 * - Path format: <user-id>/avatar.<ext>
 * - RLS enforces user can only access own profile and avatars
 *
 * Security:
 * - Safe error messages for users
 * - No raw Supabase errors exposed
 * - No Storage credentials in browser
 * - Signed URLs for private avatar access
 */

import { createClient } from '@/lib/supabase/client';
import { validateDisplayName } from '@/lib/validation/displayName';
import { validateAvatarFile, buildAvatarPath } from '@/lib/profile/avatarValidation';
import {
  ProfileServiceError,
  ProfileNotFoundError,
  ProfileUpdateError,
  AvatarUploadError,
  AvatarRemoveError,
  DisplayNameValidationError,
} from './profileErrors';

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get current user's profile
 *
 * Returns null if user not authenticated.
 * Creates profile row if missing (existing user compatibility).
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = createClient();

  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Get user error:', userError.message);
      return null;
    }

    if (!user) {
      return null;
    }

    // Get or create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Get profile error:', profileError.message);
      throw new ProfileServiceError(profileError.message, 'Không thể tải hồ sơ cá nhân.');
    }

    // Profile exists - return it with avatar URL
    if (profile) {
      const avatarUrl = profile.avatar_path
        ? await getAvatarDisplayUrl(profile.avatar_path)
        : null;

      return mapProfileToUserProfile(user.email, profile, avatarUrl);
    }

    // Profile doesn't exist - create it (existing user compatibility)
    return await ensureCurrentProfile();
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      throw err;
    }
    console.error('Get profile exception:', err);
    return null;
  }
}

/**
 * Ensure current user has a profile row
 *
 * Creates profile if missing. Initializes display_name from auth metadata if available.
 * Used for existing users who signed up before Phase 9.6.
 *
 * Race-safe: Uses upsert with ignoreDuplicates to handle concurrent calls.
 */
export async function ensureCurrentProfile(): Promise<UserProfile> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new ProfileNotFoundError('No authenticated user');
    }

    // Initialize display_name from auth metadata if available (Phase 9.5 signup)
    // Normalize to null if not a non-empty string
    const initialDisplayName =
      typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name.trim() || null
        : null;

    // Atomic upsert with ignoreDuplicates
    // If profile exists: do nothing (preserves existing display_name and avatar_path)
    // If profile missing: insert with initial display_name
    // Race-safe: Multiple concurrent calls will not cause duplicate key errors
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: initialDisplayName,
        },
        {
          onConflict: 'id',
          ignoreDuplicates: true, // Do not update if row already exists
        }
      );

    if (upsertError) {
      console.error('Upsert profile error:', upsertError.message);
      throw new ProfileUpdateError(upsertError.message, 'Không thể tạo hồ sơ cá nhân.');
    }

    // Fetch the profile (either just created or already existing)
    const { data: profile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (selectError || !profile) {
      console.error('Select profile error:', selectError?.message);
      throw new ProfileNotFoundError('Profile not found after upsert');
    }

    const avatarUrl = profile.avatar_path
      ? await getAvatarDisplayUrl(profile.avatar_path)
      : null;

    return mapProfileToUserProfile(user.email, profile, avatarUrl);
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      throw err;
    }
    console.error('Ensure profile exception:', err);
    throw new ProfileUpdateError('Unexpected error ensuring profile');
  }
}

/**
 * Update display name for current user
 *
 * Validates display name before update.
 * Creates profile if missing.
 */
export async function updateDisplayName(displayName: string): Promise<UserProfile> {
  const supabase = createClient();

  try {
    // Validate display name
    const validation = validateDisplayName(displayName);
    if (!validation.valid) {
      throw new DisplayNameValidationError(validation.message);
    }

    const normalizedName = validation.value;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new ProfileNotFoundError('No authenticated user');
    }

    // Ensure profile exists
    await ensureCurrentProfile();

    // Update display name
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: normalizedName })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update display name error:', updateError.message);
      throw new ProfileUpdateError(updateError.message);
    }

    const avatarUrl = updated.avatar_path
      ? await getAvatarDisplayUrl(updated.avatar_path)
      : null;

    return mapProfileToUserProfile(user.email, updated, avatarUrl);
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      throw err;
    }
    console.error('Update display name exception:', err);
    throw new ProfileUpdateError('Unexpected error updating display name');
  }
}

/**
 * Upload or replace avatar for current user
 *
 * Lifecycle:
 * 1. Validate file
 * 2. Upload new avatar to Storage
 * 3. Update profile avatar_path
 * 4. Remove old avatar if different path
 * 5. On failure: attempt cleanup of newly uploaded file
 *
 * Non-atomic limitation: If database update fails after upload,
 * the new file may remain orphaned in Storage.
 */
export async function uploadAvatar(file: File): Promise<UserProfile> {
  const supabase = createClient();

  try {
    // Validate file
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      throw new AvatarUploadError(validation.error || 'Invalid file', validation.error || 'File không hợp lệ');
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AvatarUploadError('No authenticated user', 'Vui lòng đăng nhập để tải ảnh lên.');
    }

    // Ensure profile exists
    const currentProfile = await ensureCurrentProfile();
    const oldAvatarPath = currentProfile.avatarPath;

    // Build new avatar path
    const newAvatarPath = buildAvatarPath(user.id, file.type);

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(newAvatarPath, file, {
        cacheControl: '3600',
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError.message);
      throw new AvatarUploadError(uploadError.message);
    }

    // Update profile with new avatar path
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_path: newAvatarPath })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update avatar path error:', updateError.message);

      // Attempt to clean up newly uploaded file
      await supabase.storage.from('avatars').remove([newAvatarPath]);

      throw new ProfileUpdateError(updateError.message, 'Không thể cập nhật ảnh đại diện.');
    }

    // Remove old avatar if path changed
    if (oldAvatarPath && oldAvatarPath !== newAvatarPath) {
      const { error: removeError } = await supabase.storage
        .from('avatars')
        .remove([oldAvatarPath]);

      if (removeError) {
        console.warn('Failed to remove old avatar:', removeError.message);
        // Non-fatal - continue with success
      }
    }

    const avatarUrl = await getAvatarDisplayUrl(newAvatarPath);

    return mapProfileToUserProfile(user.email, updated, avatarUrl);
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      throw err;
    }
    console.error('Upload avatar exception:', err);
    throw new AvatarUploadError('Unexpected error uploading avatar');
  }
}

/**
 * Remove avatar for current user
 *
 * Removes avatar file from Storage and clears avatar_path in profile.
 */
export async function removeAvatar(): Promise<UserProfile> {
  const supabase = createClient();

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AvatarRemoveError('No authenticated user', 'Vui lòng đăng nhập.');
    }

    // Get current profile
    const currentProfile = await ensureCurrentProfile();

    if (!currentProfile.avatarPath) {
      // No avatar to remove - return current profile
      return currentProfile;
    }

    const avatarPath = currentProfile.avatarPath;

    // Remove from Storage
    const { error: removeError } = await supabase.storage
      .from('avatars')
      .remove([avatarPath]);

    if (removeError) {
      console.error('Remove avatar error:', removeError.message);
      // Continue to clear database path even if Storage removal fails
    }

    // Clear avatar_path in profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_path: null })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Clear avatar path error:', updateError.message);
      throw new ProfileUpdateError(updateError.message, 'Không thể xóa ảnh đại diện.');
    }

    return mapProfileToUserProfile(user.email, updated, null);
  } catch (err) {
    if (err instanceof ProfileServiceError) {
      throw err;
    }
    console.error('Remove avatar exception:', err);
    throw new AvatarRemoveError('Unexpected error removing avatar');
  }
}

/**
 * Generate signed URL for avatar display
 *
 * Private bucket requires signed URLs for access.
 * URL expires after 1 hour.
 *
 * @param avatarPath - Storage path (not a signed URL)
 * @returns Signed URL or null if generation fails
 */
export async function getAvatarDisplayUrl(avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) {
    return null;
  }

  const supabase = createClient();

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600); // 1 hour expiry

    if (error) {
      console.error('Create signed URL error:', error.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Get avatar URL exception:', err);
    return null;
  }
}

/**
 * Map database profile row to UserProfile
 */
function mapProfileToUserProfile(
  email: string | undefined | null,
  profile: ProfileRow,
  avatarUrl: string | null
): UserProfile {
  return {
    id: profile.id,
    email: email || null,
    displayName: profile.display_name,
    avatarPath: profile.avatar_path,
    avatarUrl,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}
