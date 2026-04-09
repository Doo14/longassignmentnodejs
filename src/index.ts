

import express from 'express';
import dotenv from 'dotenv';
import { db } from './db/knex';
import { runMigration } from './db/migrate';
import { setupSwagger } from './swagger';

import authRouter from './routes/auth.route';
import resourceRouter from './routes/resource.route';

import { loggerMiddleware } from './middleware/logger.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { rateLimiterMiddleware } from './middleware/rateLimiter.middleware';
import { cacheMiddleware, cacheInvalidation } from './middleware/cache.middleware';
import { auditLogMiddleware } from './middleware/auditLog.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';


dotenv.config();

const app = express();

app.use(corsMiddleware);

// 3. Request ID — gán ID duy nhất cho mỗi request
app.use(requestIdMiddleware);

// 4. Logger — ghi log mỗi request
app.use(loggerMiddleware);

// 5. Rate Limiter — giới hạn 100 req/phút/IP (tự viết, không thư viện)
app.use(rateLimiterMiddleware);

// 6. Parse JSON body
app.use(express.json());

// 7. Cache — lưu response GET và invalidate khi write
app.use(cacheMiddleware);
app.use(cacheInvalidation);

// 8. Audit Log — ghi lại write operations
app.use(auditLogMiddleware);

app.get('/', (_req, res) => {
  res.json({
    message: 'Smart API Hub đang chạy! ',
    version: '2.0.0',
    features: [
      'Dynamic CRUD: GET, POST, PUT, PATCH, DELETE',
      'Pagination: ?_page=1&_limit=10',
      'Sorting: ?_sort=field&_order=asc|desc',
      'Filtering: ?field=value',
      'Operators: ?field_gte=x, _lte, _ne, _like',
      'Search: ?q=keyword',
      'Fields: ?_fields=id,title',
      'Expand: ?_expand=parentResource',
      'Embed: ?_embed=childResource',
      'Nested: GET /:resource/:id/:childResource',
      'Auth: POST /auth/register, POST /auth/login',
      'Rate Limiting: 100 req/min/IP',
      'Response Caching: TTL 30s',
      'Audit Logging: auto track changes',
    ],
    docs: '/api-docs',
  });
});


app.get('/health', async (_req, res) => {
  try {
    const result = await db.raw('SELECT NOW() as now');
    const dbTime = result.rows?.[0]?.now;

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        time: dbTime,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: (error as Error).message,
      },
    });
  }
});

app.use('/auth', authRouter);

app.use('/', resourceRouter);

setupSwagger(app);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  try {
    await runMigration();

    app.listen(PORT, () => {
      console.log(` Server đang chạy tại http://localhost:${PORT}`);
      console.log(` API Docs: http://localhost:${PORT}/api-docs`);
      console.log(' Auth: POST /auth/register, POST /auth/login');
      console.log(' Features: CRUD, Query, Auth, Cache, RateLimit, AuditLog');
    });
  } catch (error) {
    console.error(' Không thể khởi động server:', error);
    process.exit(1);
  }
}


function gracefulShutdown(signal: string): void {
  console.log(`\n ${signal} received. Shutting down gracefully...`);
  db.destroy()
    .then(() => {
      console.log('Database connection closed');
      process.exit(0);
    })
    .catch((err) => {
      console.error(' Error closing database:', err);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app };

start();
