// src/middleware/rateLimiter.middleware.ts
// Bonus [A]: Rate Limiting — TỰ VIẾT bằng Map, KHÔNG dùng thư viện
// Giới hạn: 100 request / 1 phút / 1 IP

import { Request, Response, NextFunction } from 'express';

// ============================================================
// CẤU TRÚC DỮ LIỆU — Lưu trạng thái rate limit
// ============================================================

/**
 * Thông tin rate limit cho 1 IP
 */
interface RateLimitInfo {
  count: number; // Số request đã gửi trong window hiện tại
  resetTime: number; // Thời điểm reset counter (Unix timestamp ms)
}

// In-memory store: IP → rate limit info
// Dùng Map vì: O(1) lookup, tự quản lý key/value, dễ cleanup
const rateLimitStore = new Map<string, RateLimitInfo>();

// CONFIG — có thể chỉnh qua biến môi trường
const WINDOW_MS = 60 * 1000; // 1 phút = 60.000ms
const MAX_REQUESTS = 100; // Tối đa 100 requests mỗi window

// ============================================================
// CLEANUP — Dọn dẹp entries hết hạn (tránh memory leak)
// ============================================================

/**
 * Chạy cleanup mỗi 5 phút
 * Xóa các IP đã hết window → giải phóng bộ nhớ
 *
 * Nếu không cleanup: mỗi IP unique sẽ chiếm ~1 entry mãi mãi
 * → Memory sẽ tăng dần khi có nhiều client khác nhau
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 phút

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [ip, info] of rateLimitStore.entries()) {
    if (now > info.resetTime) {
      rateLimitStore.delete(ip);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Rate limiter cleanup: đã xóa ${cleaned} entries hết hạn`);
  }
}, CLEANUP_INTERVAL);

// ============================================================
// MIDDLEWARE — Rate Limiter
// ============================================================

/**
 * Rate Limiter Middleware — tự viết
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Lấy IP từ request (req.ip)
 * 2. Kiểm tra trong Map: IP này đã có entry chưa?
 *    - Chưa có → tạo entry mới (count = 1, resetTime = now + 1 phút)
 *    - Có & hết hạn → reset counter
 *    - Có & chưa hết hạn → tăng counter
 * 3. Nếu counter > MAX_REQUESTS → trả 429
 * 4. Thêm headers thông tin vào response
 *
 * RESPONSE HEADERS:
 * - X-RateLimit-Limit:     Tổng request được phép (100)
 * - X-RateLimit-Remaining: Số request còn lại
 * - X-RateLimit-Reset:     Thời điểm reset (Unix timestamp seconds)
 */
export function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Lấy IP — Express 5 trả string | string[] | undefined
  const clientIp = getClientIp(req);
  const now = Date.now();

  // Lấy hoặc tạo rate limit info cho IP này
  let limitInfo = rateLimitStore.get(clientIp);

  if (!limitInfo || now > limitInfo.resetTime) {
    // IP mới hoặc window đã hết → tạo window mới
    limitInfo = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
  }

  // Tăng counter
  limitInfo.count++;
  rateLimitStore.set(clientIp, limitInfo);

  // Tính số request còn lại
  const remaining = Math.max(0, MAX_REQUESTS - limitInfo.count);
  const resetTimeSec = Math.ceil(limitInfo.resetTime / 1000);

  // Set response headers (luôn set, kể cả khi chưa bị limit)
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetTimeSec));

  // Kiểm tra vượt ngưỡng
  if (limitInfo.count > MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((limitInfo.resetTime - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));

    res.status(429).json({
      error: 'Too Many Requests',
      message: `Quá nhiều request. Vui lòng thử lại sau ${retryAfterSec} giây.`,
      retryAfter: retryAfterSec,
    });
    return;
  }

  next();
}

/**
 * Lấy IP client từ request
 * Xử lý nhiều trường hợp: proxy, load balancer, direct
 */
function getClientIp(req: Request): string {
  // X-Forwarded-For: IP thật khi qua proxy/load balancer
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  // req.ip từ Express
  return req.ip || req.socket.remoteAddress || 'unknown';
}
