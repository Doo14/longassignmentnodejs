

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors/AppError';


export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      error: err.errorType,
      message: err.message,
    };

    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    if (requestId) response.requestId = requestId;

    console.error(
      ` [${err.errorType}] ${err.message}`,
      requestId ? `(Request: ${requestId})` : ''
    );

    res.status(err.statusCode).json(response);
    return;
  }

  const pgError = err as Error & { code?: string; detail?: string };

  if (pgError.code) {
    const pgResponse = handlePostgresError(pgError);

    console.error(
      ` [PG-${pgError.code}] ${pgError.message}`,
      requestId ? `(Request: ${requestId})` : ''
    );

    res.status(pgResponse.statusCode).json({
      error: pgResponse.errorType,
      message: pgResponse.message,
      ...(requestId && { requestId }),
    });
    return;
  }

  console.error(
    ' [INTERNAL_ERROR]',
    err.message,
    requestId ? `(Request: ${requestId})` : ''
  );
  console.error(err.stack); 

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Lỗi server nội bộ',
    ...(requestId && { requestId }),
  });
}


function handlePostgresError(err: Error & { code?: string; detail?: string }): {
  statusCode: number;
  errorType: string;
  message: string;
} {
  switch (err.code) {
    case '23505': 
      return {
        statusCode: 409,
        errorType: 'CONFLICT',
        message: `Dữ liệu bị trùng: ${err.detail || err.message}`,
      };

    case '23503': 
      return {
        statusCode: 400,
        errorType: 'FOREIGN_KEY_ERROR',
        message: `Vi phạm ràng buộc khóa ngoại: ${err.detail || err.message}`,
      };

    case '23502':
      return {
        statusCode: 400,
        errorType: 'NULL_ERROR',
        message: `Thiếu dữ liệu bắt buộc: ${err.detail || err.message}`,
      };

    case '22P02': 
      return {
        statusCode: 400,
        errorType: 'TYPE_ERROR',
        message: 'Kiểu dữ liệu không hợp lệ',
      };

    case '42P01': 
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
