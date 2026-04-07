// src/errors/AppError.ts
// Custom error classes cho ứng dụng
// Mỗi loại lỗi có status code và error type riêng
// → Error handler sẽ dựa vào đây để trả response chính xác

/**
 * AppError — Base class cho tất cả lỗi tùy chỉnh
 *
 * TẠI SAO CẦN CUSTOM ERROR?
 * - Error mặc định của JS chỉ có message, không có status code
 * - Khi catch(error) → ta không biết nên trả 400 hay 404 hay 500
 * - Custom error giải quyết: mỗi loại lỗi mang sẵn status code
 *
 * VD: throw new NotFoundError('posts', 5);
 *   → Error handler tự biết trả 404 + message "posts với id=5 không tồn tại"
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorType: string;
  public readonly isOperational: boolean;

  /**
   * @param message - Mô tả lỗi
   * @param statusCode - HTTP status code (400, 404, 500, ...)
   * @param errorType - Loại lỗi (NOT_FOUND, VALIDATION_ERROR, ...)
   * @param isOperational - true = lỗi dự đoán được (client sai), false = lỗi hệ thống
   */
  constructor(
    message: string,
    statusCode: number,
    errorType: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.isOperational = isOperational;

    // Fix prototype chain cho instanceof hoạt động đúng với TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================
// CÁC LOẠI LỖI CỤ THỂ
// ============================================================

/**
 * 404 Not Found — Resource hoặc record không tồn tại
 *
 * VD: GET /nonexistent → NotFoundError('nonexistent')
 *     GET /posts/999   → NotFoundError('posts', 999)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} với id=${id} không tồn tại`
      : `Resource '${resource}' not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 400 Bad Request — Dữ liệu đầu vào không hợp lệ
 *
 * VD: POST /posts với body rỗng
 *     GET /posts/abc (ID không phải số)
 *     POST /posts với views="abc" (sai kiểu)
 */
export class ValidationError extends AppError {
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

/**
 * 429 Too Many Requests — Client gửi quá nhiều request
 * Được ném bởi rate limiter middleware
 */
export class RateLimitError extends AppError {
  constructor() {
    super(
      'Quá nhiều request. Vui lòng thử lại sau.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}
