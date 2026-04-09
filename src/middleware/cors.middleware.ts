

import cors from 'cors';

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
