

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/knex';


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

  const actionMap: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  let responseBody: unknown = null;
  const originalJson = res.json.bind(res);
  res.json = function (data: unknown) {
    responseBody = data;
    return originalJson(data);
  };

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const pathParts = req.path.split('/').filter(Boolean);
    const resource = pathParts[0]; // VD: "posts", "comments"

    if (resource === 'auth') return;

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

    const userId = req.user?.userId || null;
    const action = actionMap[req.method] || req.method;

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
        console.log(
          `Audit: ${action} ${resource}${recordId ? `/${recordId}` : ''} by user ${userId || 'anonymous'}`
        );
      })
      .catch((err: Error) => {
        console.error('  Audit log failed:', err.message);
      });
  });

  next();
}
