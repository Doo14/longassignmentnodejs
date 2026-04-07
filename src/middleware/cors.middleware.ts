// src/middleware/cors.middleware.ts
// CORS (Cross-Origin Resource Sharing) middleware
// Cho phép frontend từ domain khác gọi API (VD: React app ở localhost:5173)

import cors from 'cors';

/**
 * TẠI SAO CẦN CORS?
 *
 * Trình duyệt mặc định CHẶN request từ domain khác (Same-Origin Policy):
 * - API ở: http://localhost:3000
 * - React ở: http://localhost:5173
 * → Browser sẽ chặn vì khác port (khác origin)
 *
 * CORS cho phép server "mở cửa" cho các origin cụ thể
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Browser gửi preflight request (OPTIONS) trước
 * 2. Server trả về header cho phép origin, methods, headers
 * 3. Browser kiểm tra → nếu OK thì mới gửi request thật
 */

/**
 * Tạo CORS middleware với config phù hợp cho JSON Server
 *
 * CONFIG:
 * - origin: '*' → cho phép TẤT CẢ origin (phù hợp cho dev/public API)
 * - methods: cho phép tất cả HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * - exposedHeaders: cho phép frontend đọc X-Total-Count (pagination)
 * - credentials: true → cho phép gửi cookies/auth headers
 * - maxAge: 86400 → cache preflight response 24h (giảm OPTIONS requests)
 */
export const corsMiddleware = cors({
  // Cho phép mọi origin — JSON Server là công cụ dev, không cần restrict
  origin: '*',

  // Tất cả HTTP methods mà API hỗ trợ
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Headers mà client được phép gửi
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],

  // Headers mà client được phép ĐỌC từ response
  // X-Total-Count: tổng số records (pagination)
  // Link: pagination navigation URLs
  exposedHeaders: ['X-Total-Count', 'Link', 'X-Request-Id'],

  // Cache preflight response 24 giờ
  // → Browser không cần gửi OPTIONS lại trong 24h
  maxAge: 86400,
});
