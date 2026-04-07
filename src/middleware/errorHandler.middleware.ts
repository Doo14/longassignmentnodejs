// src/middleware/errorHandler.middleware.ts
// Global Error Handler — xử lý TẤT CẢ lỗi tập trung tại 1 chỗ
// Express gọi middleware này khi có next(error) hoặc throw trong async handler

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors/AppError';

/**
 * Global Error Handler Middleware
 *
 * TẠI SAO TẬP TRUNG XỬ LÝ LỖI?
 * - Nếu mỗi controller tự try/catch và format lỗi → code lặp lại
 * - Tập trung → format response nhất quán, dễ thay đổi
 * - Phân loại lỗi chính xác: client error vs server error
 *
 * THỨ TỰ KIỂM TRA:
 * 1. AppError (lỗi tùy chỉnh) → trả status code + message từ error
 * 2. Knex/PostgreSQL error → phân loại theo error code
 * 3. Unknown error → 500 Internal Server Error
 *
 * QUAN TRỌNG: Express yêu cầu error handler có ĐỦ 4 tham số
 * (err, req, res, next) — nếu thiếu, Express không nhận ra là error handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Lấy request ID để client có thể báo lại khi gặp lỗi
  const requestId = req.headers['x-request-id'] as string | undefined;

  // === 1. Custom AppError (NotFoundError, ValidationError, ...) ===
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      error: err.errorType,
      message: err.message,
    };

    // ValidationError có thêm details (lỗi từng field)
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    if (requestId) response.requestId = requestId;

    console.error(
      `❌ [${err.errorType}] ${err.message}`,
      requestId ? `(Request: ${requestId})` : ''
    );

    res.status(err.statusCode).json(response);
    return;
  }

  // === 2. Lỗi từ PostgreSQL/Knex (dựa vào error code) ===
  const pgError = err as Error & { code?: string; detail?: string };

  if (pgError.code) {
    const pgResponse = handlePostgresError(pgError);

    console.error(
      `❌ [PG-${pgError.code}] ${pgError.message}`,
      requestId ? `(Request: ${requestId})` : ''
    );

    res.status(pgResponse.statusCode).json({
      error: pgResponse.errorType,
      message: pgResponse.message,
      ...(requestId && { requestId }),
    });
    return;
  }

  // === 3. Unknown error → 500 Internal Server Error ===
  console.error(
    '❌ [INTERNAL_ERROR]',
    err.message,
    requestId ? `(Request: ${requestId})` : ''
  );
  console.error(err.stack); // Log stack trace để debug

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Lỗi server nội bộ',
    ...(requestId && { requestId }),
  });
}

// ============================================================
// HELPER: Phân loại lỗi PostgreSQL
// ============================================================

/**
 * Map PostgreSQL error codes → HTTP response
 *
 * Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * | PG Code | Ý nghĩa                    | HTTP Status |
 * |---------|----------------------------|-------------|
 * | 23505   | Unique constraint violated | 409         |
 * | 23503   | Foreign key violated       | 400         |
 * | 23502   | NOT NULL violated          | 400         |
 * | 22P02   | Invalid text representation| 400         |
 * | 42P01   | Table not found            | 404         |
 */
function handlePostgresError(err: Error & { code?: string; detail?: string }): {
  statusCode: number;
  errorType: string;
  message: string;
} {
  switch (err.code) {
    case '23505': // unique_violation
      return {
        statusCode: 409,
        errorType: 'CONFLICT',
        message: `Dữ liệu bị trùng: ${err.detail || err.message}`,
      };

    case '23503': // foreign_key_violation
      return {
        statusCode: 400,
        errorType: 'FOREIGN_KEY_ERROR',
        message: `Vi phạm ràng buộc khóa ngoại: ${err.detail || err.message}`,
      };

    case '23502': // not_null_violation
      return {
        statusCode: 400,
        errorType: 'NULL_ERROR',
        message: `Thiếu dữ liệu bắt buộc: ${err.detail || err.message}`,
      };

    case '22P02': // invalid_text_representation
      return {
        statusCode: 400,
        errorType: 'TYPE_ERROR',
        message: 'Kiểu dữ liệu không hợp lệ',
      };

    case '42P01': // undefined_table
      return {
        statusCode: 404,
        errorType: 'NOT_FOUND',
        message: 'Bảng không tồn tại',
      };

    default:
      return {
        statusCode: 500,
        errorType: 'DATABASE_ERROR',
        message: 'Lỗi database không xác định',
      };
  }
}
