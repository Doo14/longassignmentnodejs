// src/middleware/cache.middleware.ts
// Bonus [B]: Response Caching — In-memory cache cho GET requests
// TTL 30 giây, auto-invalidate khi có write operation

import { Request, Response, NextFunction } from 'express';

// ============================================================
// CẤU TRÚC DỮ LIỆU — Cache Store
// ============================================================

/**
 * Cache entry: lưu response data + thời gian hết hạn
 */
interface CacheEntry {
  data: unknown; // Response body
  statusCode: number; // HTTP status code
  expireAt: number; // Unix timestamp (ms) khi entry hết hạn
  headers: Record<string, string>; // Custom headers cần cache (X-Total-Count, etc.)
}

// In-memory cache: URL → cached response
// Key format: "GET /posts?_page=1&_limit=10" (method + full URL)
const cacheStore = new Map<string, CacheEntry>();

// CONFIG
const TTL_MS = 30 * 1000; // 30 giây

// ============================================================
// CLEANUP — Dọn dẹp entries hết hạn
// ============================================================

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expireAt) {
      cacheStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cache cleanup: đã xóa ${cleaned} entries hết hạn`);
  }
}, 60 * 1000); // Cleanup mỗi 1 phút

// ============================================================
// MIDDLEWARE 1: Cache GET responses
// ============================================================

/**
 * Cache Middleware — lưu response của GET requests
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Nếu request là GET → kiểm tra cache
 *    - Cache hit (còn hạn) → trả cached response ngay, không query DB
 *    - Cache miss → tiếp tục handler gốc, intercept response để lưu cache
 * 2. Nếu request KHÔNG phải GET → skip (không cache write operations)
 *
 * CACHE KEY: method + originalUrl (VD: "GET:/posts?_page=1")
 * → Mỗi URL + query params khác nhau là 1 cache entry riêng
 */
export function cacheMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Chỉ cache GET requests
  if (req.method !== 'GET') {
    next();
    return;
  }

  // Không cache health check và auth endpoints
  if (req.path === '/health' || req.path.startsWith('/auth')) {
    next();
    return;
  }

  const cacheKey = `GET:${req.originalUrl}`;
  const now = Date.now();

  // Kiểm tra cache
  const cached = cacheStore.get(cacheKey);
  if (cached && now < cached.expireAt) {
    // CACHE HIT — trả cached response
    // Set cached headers
    for (const [key, value] of Object.entries(cached.headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('X-Cache', 'HIT');
    res.status(cached.statusCode).json(cached.data);
    return;
  }

  // CACHE MISS — intercept response để lưu cache
  res.setHeader('X-Cache', 'MISS');

  // Override res.json để capture response data
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    // Chỉ cache response thành công (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Capture headers cần cache
      const headersToCache: Record<string, string> = {};
      const totalCount = res.getHeader('X-Total-Count');
      if (totalCount) headersToCache['X-Total-Count'] = String(totalCount);
      const link = res.getHeader('Link');
      if (link) headersToCache['Link'] = String(link);

      cacheStore.set(cacheKey, {
        data,
        statusCode: res.statusCode,
        expireAt: now + TTL_MS,
        headers: headersToCache,
      });
    }

    return originalJson(data);
  };

  next();
}

// ============================================================
// MIDDLEWARE 2: Invalidate cache khi có write operation
// ============================================================

/**
 * Cache Invalidation Middleware
 *
 * Khi có POST/PUT/PATCH/DELETE thành công → xóa TẤT CẢ cache
 * của resource đó
 *
 * VD: DELETE /posts/1 → xóa cache "GET:/posts", "GET:/posts/1",
 *     "GET:/posts?_page=1", etc.
 *
 * PHẢI đặt SAU route handlers (dùng res.on('finish') để detect)
 */
export function cacheInvalidation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Chỉ invalidate cho write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      // Chỉ invalidate nếu request thành công (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Lấy resource name từ URL: /posts/1 → "posts"
        const resource = req.path.split('/').filter(Boolean)[0];
        if (resource) {
          invalidateResource(resource);
        }
      }
    });
  }

  next();
}

/**
 * Xóa TẤT CẢ cache entries liên quan đến 1 resource
 *
 * VD: invalidateResource("posts") → xóa:
 *   "GET:/posts"
 *   "GET:/posts/1"
 *   "GET:/posts?_page=1&_limit=10"
 *   "GET:/posts/1/comments"
 */
function invalidateResource(resource: string): void {
  let invalidated = 0;

  for (const key of cacheStore.keys()) {
    // Key format: "GET:/posts..." → check nếu URL chứa resource
    if (key.includes(`/${resource}`)) {
      cacheStore.delete(key);
      invalidated++;
    }
  }

  if (invalidated > 0) {
    console.log(
      `🗑️  Cache invalidated: xóa ${invalidated} entries cho "${resource}"`
    );
  }
}
