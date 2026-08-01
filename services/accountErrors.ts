/**
 * Account Service Errors
 *
 * Custom error types for account management operations.
 * Provides safe Vietnamese error messages for users.
 */

export class AccountServiceError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'AccountServiceError';
  }
}

export class PasswordResetError extends AccountServiceError {
  constructor(message: string, userMessage: string = 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.') {
    super(message, userMessage);
    this.name = 'PasswordResetError';
  }
}

export class PasswordUpdateError extends AccountServiceError {
  constructor(message: string, userMessage: string = 'Không thể cập nhật mật khẩu. Vui lòng thử lại.') {
    super(message, userMessage);
    this.name = 'PasswordUpdateError';
  }
}

export class InvalidRecoveryError extends AccountServiceError {
  constructor(message: string = 'Invalid or expired recovery link') {
    super(message, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    this.name = 'InvalidRecoveryError';
  }
}
