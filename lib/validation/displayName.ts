/**
 * Display Name Validation
 *
 * Shared validation logic for display name in signup and profile settings.
 *
 * Rules:
 * - Required (not empty after trimming)
 * - No all-whitespace values
 * - Minimum 1 visible character after trimming
 * - Maximum 80 characters
 * - Unicode and Vietnamese characters supported
 * - Internal spaces preserved
 */

export type DisplayNameValidationResult =
  | {
      valid: true;
      value: string;
    }
  | {
      valid: false;
      message: string;
    };

/**
 * Validate and normalize display name
 *
 * @param input - Raw display name input
 * @returns Validation result with normalized value or error message
 *
 * @example
 * validateDisplayName('  Nguyễn Văn An  ')
 * // Returns: { valid: true, value: 'Nguyễn Văn An' }
 *
 * @example
 * validateDisplayName('   ')
 * // Returns: { valid: false, message: 'Vui lòng nhập tên hiển thị.' }
 */
export function validateDisplayName(
  input: string
): DisplayNameValidationResult {
  // Trim leading and trailing whitespace
  const trimmed = input.trim();

  // Check if empty or whitespace-only
  if (trimmed.length === 0) {
    return {
      valid: false,
      message: 'Vui lòng nhập tên hiển thị.',
    };
  }

  // Check maximum length
  if (trimmed.length > 80) {
    return {
      valid: false,
      message: 'Tên hiển thị không được vượt quá 80 ký tự.',
    };
  }

  // Valid - return normalized value
  return {
    valid: true,
    value: trimmed,
  };
}
