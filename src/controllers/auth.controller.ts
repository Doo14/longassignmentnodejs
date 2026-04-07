// src/controllers/auth.controller.ts
// Authentication controller: Register + Login
// Buổi 7: JWT-based authentication

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db/knex';
import { tableExists } from '../utils/tableValidator';

// ============================================================
// ZOD SCHEMAS — Validate đầu vào Register/Login
// ============================================================

/**
 * Schema validate cho Register
 * - email: phải đúng format email
 * - password: tối thiểu 6 ký tự
 * - name: bắt buộc
 * - role: chỉ 'user' hoặc 'admin', mặc định 'user'
 */
const registerSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc' })
    .email({ message: 'Email không hợp lệ' }),
  password: z
    .string({ message: 'Password là bắt buộc' })
    .min(6, { message: 'Password tối thiểu 6 ký tự' }),
  name: z.string({ message: 'Name là bắt buộc' }).min(1),
  role: z.enum(['user', 'admin']).default('user'),
  age: z.number().optional(),
});

/**
 * Schema validate cho Login
 * - email + password bắt buộc
 */
const loginSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc' })
    .email({ message: 'Email không hợp lệ' }),
  password: z
    .string({ message: 'Password là bắt buộc' })
    .min(1, { message: 'Password không được rỗng' }),
});

// ============================================================
// JWT SECRET — lấy từ biến môi trường
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'pg-json-server-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ============================================================
// POST /auth/register — Đăng ký tài khoản mới
// ============================================================

/**
 * Register flow:
 * 1. Validate body bằng Zod (email format, password length)
 * 2. Kiểm tra email đã tồn tại chưa
 * 3. Hash password bằng bcrypt (10 salt rounds)
 * 4. INSERT user mới vào database
 * 5. Trả về user info (KHÔNG trả password)
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Bước 1: Validate body
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const { email, password, name, role, age } = parsed.data;

    // Bước 2: Kiểm tra bảng users tồn tại
    if (!(await tableExists('users'))) {
      res.status(500).json({ error: 'Bảng users chưa được tạo' });
      return;
    }

    // Bước 3: Kiểm tra email trùng
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      res.status(409).json({ error: 'Email đã được sử dụng' });
      return;
    }

    // Bước 4: Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Bước 5: Insert user
    const [newUser] = await db('users')
      .insert({
        email,
        password: hashedPassword,
        name,
        role,
        ...(age !== undefined && { age }),
      })
      .returning('*');

    // Bước 6: Trả về user (loại bỏ password)
    const { password: _pw, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// POST /auth/login — Đăng nhập & cấp JWT
// ============================================================

/**
 * Login flow:
 * 1. Validate body bằng Zod
 * 2. Tìm user theo email
 * 3. So sánh password (bcrypt.compare)
 * 4. Tạo JWT token (chứa userId, email, role)
 * 5. Trả về token + user info
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Bước 1: Validate body
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: parsed.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const { email, password } = parsed.data;

    // Bước 2: Kiểm tra bảng users
    if (!(await tableExists('users'))) {
      res.status(500).json({ error: 'Bảng users chưa được tạo' });
      return;
    }

    // Bước 3: Tìm user
    const user = await db('users').where({ email }).first();
    if (!user) {
      res.status(401).json({ error: 'Email hoặc password không đúng' });
      return;
    }

    // Bước 4: So sánh password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Email hoặc password không đúng' });
      return;
    }

    // Bước 5: Tạo JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    // Bước 6: Trả về token + user info
    const { password: _pw, ...userWithoutPassword } = user;

    res.status(200).json({
      message: 'Đăng nhập thành công',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
}
