
import { Request, Response, NextFunction } from 'express';


interface RateLimitInfo {
  count: number; 
  resetTime: number; 
}

const rateLimitStore = new Map<string, RateLimitInfo>();

const WINDOW_MS = 60 * 1000; 
const MAX_REQUESTS = 100; 


const CLEANUP_INTERVAL = 5 * 60 * 1000; 

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


export function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientIp = getClientIp(req);
  const now = Date.now();

  let limitInfo = rateLimitStore.get(clientIp);

  if (!limitInfo || now > limitInfo.resetTime) {
    limitInfo = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
  }

  limitInfo.count++;
  rateLimitStore.set(clientIp, limitInfo);

  const remaining = Math.max(0, MAX_REQUESTS - limitInfo.count);
  const resetTimeSec = Math.ceil(limitInfo.resetTime / 1000);

  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetTimeSec));

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


function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}
