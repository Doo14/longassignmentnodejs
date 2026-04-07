// src/middleware/auth.middleware.ts
// Authentication & Authorization middleware
// Bảo vệ routes: Write cần Token, DELETE cần admin role

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pg-json-server-secret-key-2024';

/**
 * Interface cho JWT payload (dữ liệu bên trong token)
 */
export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

/**
 * Mở rộng Express Request để chứa thông tin user đã xác thực
 * Sau khi middleware verify token → req.user chứa payload
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ============================================================
// MIDDLEWARE 1: Authenticate — Xác thực JWT Token
// ============================================================

/**
 * Authenticate middleware — verify JWT token
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Đọc header Authorization: "Bearer <token>"
 * 2. Verify token bằng JWT_SECRET
 * 3. Nếu hợp lệ → gắn payload lên req.user → next()
 * 4. Nếu không hợp lệ → trả 401 Unauthorized
 *
 * DÙNG CHO: Tất cả write operations (POST, PUT, PATCH, DELETE)
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Lấy token từ header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Cần đăng nhập để thực hiện hành động này',
    });
    return;
  }

  // Tách "Bearer " khỏi token
  const token = authHeader.split(' ')[1];

  try {
    // Verify token — nếu hết hạn hoặc sai secret → throw error
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if ((error as Error).name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expired',
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
      return;
    }

    res.status(401).json({
      error: 'Invalid token',
      message: 'Token không hợp lệ',
    });
  }
}

// ============================================================
// MIDDLEWARE 2: Authorize Admin — Chỉ admin được DELETE
// ============================================================

/**
 * Authorize admin middleware
 *
 * PHẢI ĐẶT SAU authenticate middleware (cần req.user)
 *
 * DÙNG CHO: DELETE requests — chỉ admin mới được xóa
 */
export function authorizeAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Chưa xác thực',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Chỉ admin mới được thực hiện hành động này',
    });
    return;
  }

  next();
}
