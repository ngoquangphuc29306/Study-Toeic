/**
 * Progress Service Errors
 *
 * Phase 5: Typed errors for progress operations
 */

export class ProgressSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressSubmissionError';
  }
}

export class ProgressAuthenticationError extends Error {
  constructor() {
    super('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    this.name = 'ProgressAuthenticationError';
  }
}

export class ProgressNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy từ vựng hoặc bạn không có quyền thao tác.');
    this.name = 'ProgressNotFoundError';
  }
}

export class ProgressNetworkError extends Error {
  constructor() {
    super('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
    this.name = 'ProgressNetworkError';
  }
}
