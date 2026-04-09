
import { Request, Response, NextFunction } from 'express';


interface CacheEntry {
  data: unknown; 
  statusCode: number; 
  expireAt: number; 
  headers: Record<string, string>; 
}

const cacheStore = new Map<string, CacheEntry>();


const TTL_MS = 30 * 1000; 


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
    console.log(`Cache cleanup: đã xóa ${cleaned} entries hết hạn`);
  }
}, 60 * 1000); 
export function cacheMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
 
  if (req.method !== 'GET') {
    next();
    return;
  }

  
  if (req.path === '/health' || req.path.startsWith('/auth')) {
    next();
    return;
  }

  const cacheKey = `GET:${req.originalUrl}`;
  const now = Date.now();


  const cached = cacheStore.get(cacheKey);
  if (cached && now < cached.expireAt) {
  
    for (const [key, value] of Object.entries(cached.headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('X-Cache', 'HIT');
    res.status(cached.statusCode).json(cached.data);
    return;
  }

  res.setHeader('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {

    if (res.statusCode >= 200 && res.statusCode < 300) {

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


export function cacheInvalidation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resource = req.path.split('/').filter(Boolean)[0];
        if (resource) {
          invalidateResource(resource);
        }
      }
    });
  }

  next();
}


function invalidateResource(resource: string): void {
  let invalidated = 0;

  for (const key of cacheStore.keys()) {
    if (key.includes(`/${resource}`)) {
      cacheStore.delete(key);
      invalidated++;
    }
  }

  if (invalidated > 0) {
    console.log(
      ` Cache invalidated: xóa ${invalidated} entries cho "${resource}"`
    );
  }
}
