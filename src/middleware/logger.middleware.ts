

import { Request, Response, NextFunction } from 'express';


export function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const color = getStatusColor(statusCode);
    const reset = '\x1b[0m';

    console.log(
      `${color}[${timestamp}] ${method} ${originalUrl} → ${statusCode} (${duration}ms)${reset}`
    );
  });

  next();
}


function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return '\x1b[31m'; 
  if (statusCode >= 400) return '\x1b[33m'; 
  if (statusCode >= 300) return '\x1b[36m'; 
  return '\x1b[32m'; 
}
