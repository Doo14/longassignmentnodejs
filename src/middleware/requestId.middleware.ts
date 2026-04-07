// src/middleware/requestId.middleware.ts
// Middleware gán Request ID duy nhất cho mỗi request
// Dùng để trace/debug khi có lỗi: "Lỗi ở request nào?"

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Request ID Middleware
 *
 * TẠI SAO CẦN REQUEST ID?
 * - Khi nhiều request xảy ra cùng lúc, log bị xáo trộn
 * - Request ID giúp nhóm các log lại: "Tất cả log có ID abc123 → cùng 1 request"
 * - Khi lỗi xảy ra ở production → client báo ID → dev tìm ngay trong log
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Client gửi request → middleware tạo UUID
 * 2. Gắn ID lên req.headers['x-request-id'] (để middleware khác đọc)
 * 3. Thêm ID vào response header X-Request-Id (để client nhận)
 *
 * VD Response header: X-Request-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Nếu client đã gửi kèm X-Request-Id → dùng luôn (cho distributed tracing)
  // Nếu không → tạo UUID mới
  const requestId =
    (req.headers['x-request-id'] as string) || crypto.randomUUID();

  // Gắn lên request để các middleware/controller khác sử dụng
  req.headers['x-request-id'] = requestId;

  // Thêm vào response header để client nhận lại
  res.setHeader('X-Request-Id', requestId);

  next();
}
