

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db/knex';
import { tableExists } from '../utils/tableValidator';


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

const loginSchema = z.object({
  email: z
    .string({ message: 'Email là bắt buộc' })
    .email({ message: 'Email không hợp lệ' }),
  password: z
    .string({ message: 'Password là bắt buộc' })
    .min(1, { message: 'Password không được rỗng' }),
});


const JWT_SECRET = process.env.JWT_SECRET || 'pg-json-server-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';


export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
   
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

    if (!(await tableExists('users'))) {
      res.status(500).json({ error: 'Bảng users chưa được tạo' });
      return;
    }

    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      res.status(409).json({ error: 'Email đã được sử dụng' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db('users')
      .insert({
        email,
        password: hashedPassword,
        name,
        role,
        ...(age !== undefined && { age }),
      })
      .returning('*');

    const { password: _pw, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
}


export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
  
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

    if (!(await tableExists('users'))) {
      res.status(500).json({ error: 'Bảng users chưa được tạo' });
      return;
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      res.status(401).json({ error: 'Email hoặc password không đúng' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Email hoặc password không đúng' });
      return;
    }
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);
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
