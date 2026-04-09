
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


export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} với id=${id} không tồn tại`
      : `Resource '${resource}' not found`;
    super(message, 404, 'NOT_FOUND');
  }
}


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


export class RateLimitError extends AppError {
  constructor() {
    super(
      'Quá nhiều request. Vui lòng thử lại sau.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}
