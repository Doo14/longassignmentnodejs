// src/middleware/auditLog.middleware.ts
// Bonus [C]: Audit Log — Ghi lại lịch sử thay đổi dữ liệu
// Ghi async, không block response

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/knex';

/**
 * Audit Log Middleware
 *
 * GHI LẠI: Ai đã làm gì, với resource nào, record nào, khi nào
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Intercept write requests (POST, PUT, PATCH, DELETE)
 * 2. Khi response hoàn tất (event 'finish') → kiểm tra status thành công
 * 3. Ghi 1 dòng vào bảng audit_logs (async, không chờ kết quả)
 * 4. Nếu ghi log thất bại → chỉ console.error, KHÔNG ảnh hưởng response
 *
 * KHÔNG BLOCK: Dùng Promise.catch() thay vì await
 * → Response trả về ngay, log ghi ngầm phía sau
 */
export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Chỉ audit write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  // Map HTTP method → action name
  const actionMap: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  // Capture response body cho audit (override res.json)
  let responseBody: unknown = null;
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    responseBody = data;
    return originalJson(data);
  };

  res.on('finish', () => {
    // Chỉ log nếu request thành công (2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    // Parse thông tin từ URL
    const pathParts = req.path.split('/').filter(Boolean);
    const resource = pathParts[0]; // VD: "posts", "comments"

    // Bỏ qua auth routes
    if (resource === 'auth') return;

    // Lấy record ID từ URL hoặc response body
    let recordId: number | null = null;
    if (pathParts[1]) {
      recordId = parseInt(pathParts[1], 10) || null;
    } else if (
      responseBody &&
      typeof responseBody === 'object' &&
      'id' in (responseBody as Record<string, unknown>)
    ) {
      recordId = (responseBody as Record<string, unknown>).id as number;
    }

    // Lấy user ID từ JWT payload (nếu đã authenticate)
    const userId = req.user?.userId || null;

    // Action
    const action = actionMap[req.method] || req.method;

    // GHI LOG ASYNC — không block response
    // Dùng .catch() để handle lỗi mà không crash
    db('audit_logs')
      .insert({
        user_id: userId,
        action,
        resource,
        record_id: recordId,
        changes: req.method !== 'DELETE' ? JSON.stringify(req.body) : null,
        timestamp: new Date(),
      })
      .then(() => {
        // Log thành công (optional, comment out trong production)
        console.log(
          `📝 Audit: ${action} ${resource}${recordId ? `/${recordId}` : ''} by user ${userId || 'anonymous'}`
        );
      })
      .catch((err: Error) => {
        // Ghi log thất bại → chỉ warning, KHÔNG ảnh hưởng app
        console.error('⚠️  Audit log failed:', err.message);
      });
  });

  next();
}
