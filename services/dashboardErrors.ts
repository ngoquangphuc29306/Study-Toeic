/**
 * Dashboard Service Errors
 *
 * Phase 7: Typed error classes for Dashboard data operations
 */

export class DashboardDataError extends Error {
  constructor(message: string = 'Không thể tải dữ liệu Dashboard. Vui lòng thử lại.') {
    super(message);
    this.name = 'DashboardDataError';
  }
}

export class DashboardAuthError extends Error {
  constructor(message: string = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.') {
    super(message);
    this.name = 'DashboardAuthError';
  }
}
