/**
 * Avatar File Validation
 *
 * Client-side validation for avatar image uploads.
 *
 * Rules:
 * - Allowed MIME types: image/jpeg, image/png, image/webp
 * - Maximum file size: 2 MB (2,097,152 bytes)
 * - File must exist and not be empty
 *
 * Security:
 * - Do not trust file extensions alone
 * - Validate MIME type from File object
 * - Validate size before upload
 */

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB in bytes

/**
 * Validate avatar file before upload
 *
 * @param file - File object from input[type="file"]
 * @returns Validation result with error message if invalid
 */
export function validateAvatarFile(file: File | null | undefined): AvatarValidationResult {
  // Check file exists
  if (!file) {
    return {
      valid: false,
      error: 'Vui lòng chọn một ảnh.',
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Ảnh đại diện phải là JPG, PNG hoặc WebP.',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Ảnh đại diện không được vượt quá 2 MB.',
    };
  }

  // Check for empty file
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File ảnh không hợp lệ.',
    };
  }

  return { valid: true };
}

/**
 * Get file extension from MIME type
 *
 * @param mimeType - MIME type string (e.g., 'image/jpeg')
 * @returns File extension (e.g., 'jpg')
 */
export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg'; // fallback
  }
}

/**
 * Build avatar storage path for current user
 *
 * Format: <user-id>/avatar.<extension>
 *
 * @param userId - Authenticated user ID
 * @param mimeType - MIME type of the avatar file
 * @returns Storage path string
 */
export function buildAvatarPath(userId: string, mimeType: string): string {
  const extension = getExtensionFromMimeType(mimeType);
  return `${userId}/avatar.${extension}`;
}
