// src/middleware/security.middleware.ts
// Security middleware: Helmet HTTP headers
// Bảo vệ API khỏi các cuộc tấn công phổ biến

import helmet from 'helmet';

// ============================================================
// HELMET — HTTP Security Headers
// ============================================================

/**
 * Helmet tự động thêm các HTTP headers bảo mật:
 *
 * | Header                    | Chống tấn công         | Ý nghĩa                          |
 * |---------------------------|------------------------|-----------------------------------|
 * | X-Content-Type-Options    | MIME sniffing          | Browser không đoán content type   |
 * | X-Frame-Options           | Clickjacking           | Không cho embed trong iframe      |
 * | X-XSS-Protection          | XSS (cũ)              | Browser chặn XSS đơn giản        |
 * | Strict-Transport-Security | Downgrade attacks      | Bắt buộc HTTPS                   |
 * | Content-Security-Policy   | XSS, injection         | Chỉ cho phép resource tin cậy    |
 *
 * contentSecurityPolicy: false → tắt CSP vì đây là API, không serve HTML
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // API không serve HTML → không cần CSP
});
