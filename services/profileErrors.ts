/**
 * Profile Service Errors
 *
 * Custom error types for profile management operations.
 * Provides safe Vietnamese error messages for users.
 */

export class ProfileServiceError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

export class ProfileNotFoundError extends ProfileServiceError {
  constructor(message: string = 'Profile not found') {
    super(message, 'Không tìm thấy hồ sơ cá nhân.');
    this.name = 'ProfileNotFoundError';
  }
}

export class ProfileUpdateError extends ProfileServiceError {
  constructor(message: string, userMessage: string = 'Không thể cập nhật hồ sơ. Vui lòng thử lại.') {
    super(message, userMessage);
    this.name = 'ProfileUpdateError';
  }
}

export class AvatarUploadError extends ProfileServiceError {
  constructor(message: string, userMessage: string = 'Không thể tải ảnh đại diện lên. Vui lòng thử lại.') {
    super(message, userMessage);
    this.name = 'AvatarUploadError';
  }
}

export class AvatarRemoveError extends ProfileServiceError {
  constructor(message: string, userMessage: string = 'Không thể xóa ảnh đại diện. Vui lòng thử lại.') {
    super(message, userMessage);
    this.name = 'AvatarRemoveError';
  }
}

export class DisplayNameValidationError extends ProfileServiceError {
  constructor(message: string) {
    super(message, message); // message is already user-friendly Vietnamese
    this.name = 'DisplayNameValidationError';
  }
}
