// src/middleware/logger.middleware.ts
// Middleware ghi log mỗi request vào console
// Hiển thị: [timestamp] METHOD /path → statusCode (duration ms)

import { Request, Response, NextFunction } from 'express';

/**
 * Logger middleware — ghi log mỗi HTTP request
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Khi request ĐẾN → ghi lại thời gian bắt đầu
 * 2. Khi response XONG (event 'finish') → tính duration và log ra console
 *
 * OUTPUT MẪU:
 *   [2024-01-15 10:30:15] GET /posts → 200 (12ms)
 *   [2024-01-15 10:30:16] POST /users → 201 (45ms)
 *   [2024-01-15 10:30:17] DELETE /posts/99 → 404 (8ms)
 *
 * MÀU SẮC:
 * - 🟢 2xx (thành công) → màu xanh lá
 * - 🟡 3xx (redirect)   → màu vàng
 * - 🔴 4xx/5xx (lỗi)    → màu đỏ
 */
export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Ghi lại thời điểm request bắt đầu
  const start = Date.now();

  // Lắng nghe event 'finish' — được emit khi response đã gửi xong
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Chọn màu dựa trên status code
    const color = getStatusColor(statusCode);
    const reset = '\x1b[0m';

    console.log(
      `${color}[${timestamp}] ${method} ${originalUrl} → ${statusCode} (${duration}ms)${reset}`
    );
  });

  // Chuyển request sang middleware/route tiếp theo
  next();
}

/**
 * Chọn ANSI color code dựa trên HTTP status code
 * - 2xx: xanh lá (thành công)
 * - 3xx: xanh dương (redirect)
 * - 4xx: vàng (client error)
 * - 5xx: đỏ (server error)
 */
function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return '\x1b[31m'; // Đỏ
  if (statusCode >= 400) return '\x1b[33m'; // Vàng
  if (statusCode >= 300) return '\x1b[36m'; // Xanh dương
  return '\x1b[32m'; // Xanh lá
}
