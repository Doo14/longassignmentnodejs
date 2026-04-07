// src/index.ts
// Entry point — Khởi động Express server và đăng ký tất cả middleware + routes
// Buổi 7: CORS, Helmet, Rate Limiter, Cache, Audit Log, Auth, Error Handler

import express from 'express';
import dotenv from 'dotenv';
import { db } from './db/knex';
import { runMigration } from './db/migrate';
import { setupSwagger } from './swagger';

// Routes
import authRouter from './routes/auth.route';
import resourceRouter from './routes/resource.route';

// Middleware
import { loggerMiddleware } from './middleware/logger.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { helmetMiddleware } from './middleware/security.middleware';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { rateLimiterMiddleware } from './middleware/rateLimiter.middleware';
import { cacheMiddleware, cacheInvalidation } from './middleware/cache.middleware';
import { auditLogMiddleware } from './middleware/auditLog.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

// Đọc biến môi trường từ file .env
dotenv.config();

// Tạo Express app
const app = express();

// ============================================================
// MIDDLEWARE STACK (thứ tự quan trọng!)
// ============================================================

// 1. Security headers (Helmet) — thêm HTTP security headers
app.use(helmetMiddleware);

// 2. CORS — cho phép frontend khác domain gọi API
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

// ============================================================
// ROUTES
// ============================================================

// Route gốc — kiểm tra server có đang chạy không
app.get('/', (_req, res) => {
  res.json({
    message: 'Smart API Hub đang chạy! 🚀',
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

// Health check — ping DB thật
app.get('/health', async (_req, res) => {
  try {
    // Ping database bằng query đơn giản
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

// Auth routes — /auth/register, /auth/login
app.use('/auth', authRouter);

// Dynamic resource routes — /:resource, /:resource/:id, etc.
app.use('/', resourceRouter);

// ============================================================
// SWAGGER UI — API Documentation
// ============================================================
setupSwagger(app);

// ============================================================
// GLOBAL ERROR HANDLER — phải đặt SAU tất cả routes
// ============================================================
app.use(errorHandler);

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
const PORT = process.env.PORT || 3000;

async function start(): Promise<void> {
  try {
    await runMigration();

    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
      console.log('🔒 Auth: POST /auth/register, POST /auth/login');
      console.log('⚡ Features: CRUD, Query, Auth, Cache, RateLimit, AuditLog');
    });
  } catch (error) {
    console.error('❌ Không thể khởi động server:', error);
    process.exit(1);
  }
}

// ============================================================
// GRACEFUL SHUTDOWN — Dọn dẹp khi tắt server
// ============================================================

/**
 * Khi nhận tín hiệu tắt (Ctrl+C, Docker stop) → đóng DB connection
 * Tránh connection leak và data corruption
 */
function gracefulShutdown(signal: string): void {
  console.log(`\n📴 ${signal} received. Shutting down gracefully...`);
  db.destroy()
    .then(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error closing database:', err);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export app cho testing (Supertest cần import app)
export { app };

start();
