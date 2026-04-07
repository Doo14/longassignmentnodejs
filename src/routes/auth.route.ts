// src/routes/auth.route.ts
// Routes cho authentication: Register + Login
// Không cần middleware auth — đây là public routes

import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

// ============================================================
// AUTH ROUTES — Public (không cần token)
// ============================================================
// | Method | URL              | Controller | Mô tả           |
// |--------|------------------|------------|------------------|
// | POST   | /auth/register   | register   | Đăng ký          |
// | POST   | /auth/login      | login      | Đăng nhập + JWT  |
// ============================================================

router.post('/register', register);
router.post('/login', login);

export default router;
