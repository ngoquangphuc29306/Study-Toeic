/**
 * Password Validation
 *
 * Shared password validation logic for signup, password change, and password reset.
 *
 * Rules:
 * - Minimum 8 characters
 * - No all-whitespace passwords
 * - Confirmation must match
 */

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate a single password
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { valid: false, message: 'Mật khẩu là bắt buộc' };
  }

  if (password.trim().length === 0) {
    return { valid: false, message: 'Mật khẩu không được chỉ chứa khoảng trắng' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' };
  }

  return { valid: true };
}

/**
 * Validate password and confirmation match
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  // First validate the password itself
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return passwordCheck;
  }

  // Validate confirmation
  if (!confirmPassword) {
    return { valid: false, message: 'Xác nhận mật khẩu là bắt buộc' };
  }

  if (password !== confirmPassword) {
    return { valid: false, message: 'Mật khẩu xác nhận không khớp' };
  }

  return { valid: true };
}
