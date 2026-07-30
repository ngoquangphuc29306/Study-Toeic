/**
 * Authentication Validation Schemas
 *
 * Validation rules for email/password authentication.
 * Keeps validation logic separate from presentation components.
 *
 * MVP Rules:
 * - Email: required, valid format, trimmed
 * - Password: minimum 8 characters
 * - Password confirmation: must match password
 */

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate sign-up input
 */
export function validateSignUp(input: SignUpInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Email validation
  const email = input.email.trim();
  if (!email) {
    errors.push({ field: 'email', message: 'Email là bắt buộc' });
  } else if (!isValidEmail(email)) {
    errors.push({ field: 'email', message: 'Email không hợp lệ' });
  }

  // Password validation
  if (!input.password) {
    errors.push({ field: 'password', message: 'Mật khẩu là bắt buộc' });
  } else if (input.password.length < 8) {
    errors.push({ field: 'password', message: 'Mật khẩu phải có ít nhất 8 ký tự' });
  }

  // Password confirmation validation
  if (!input.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Xác nhận mật khẩu là bắt buộc' });
  } else if (input.password !== input.confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Mật khẩu xác nhận không khớp' });
  }

  return errors;
}

/**
 * Validate sign-in input
 */
export function validateSignIn(input: SignInInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Email validation
  const email = input.email.trim();
  if (!email) {
    errors.push({ field: 'email', message: 'Email là bắt buộc' });
  } else if (!isValidEmail(email)) {
    errors.push({ field: 'email', message: 'Email không hợp lệ' });
  }

  // Password validation
  if (!input.password) {
    errors.push({ field: 'password', message: 'Mật khẩu là bắt buộc' });
  }

  return errors;
}
