
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pg-json-server-secret-key-2024';

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}


declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}


export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Cần đăng nhập để thực hiện hành động này',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
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
