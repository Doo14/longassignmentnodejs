// src/routes/resource.route.ts
// Định nghĩa các route động (dynamic routes) cho resource
// Buổi 7: Thêm auth middleware — Write cần token, DELETE cần admin

import { Router } from 'express';
import {
  getAll,
  getById,
  getNestedChildren,
  create,
  updateFull,
  updatePartial,
  remove,
} from '../controllers/resource.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth.middleware';

const router = Router();

// ============================================================
// BẢNG TỔNG HỢP CÁC ROUTE
// ============================================================
// | Method | URL                   | Auth      | Controller        |
// |--------|-----------------------|-----------|-------------------|
// | GET    | /:resource            | Public    | getAll            |
// | GET    | /:resource/:id        | Public    | getById           |
// | GET    | /:resource/:id/:child | Public    | getNestedChildren |
// | POST   | /:resource            | Token     | create            |
// | PUT    | /:resource/:id        | Token     | updateFull        |
// | PATCH  | /:resource/:id        | Token     | updatePartial     |
// | DELETE | /:resource/:id        | Admin     | remove            |
// ============================================================

// === GET routes — Public (không cần auth) ===
router.get('/:resource', getAll);
router.get('/:resource/:id', getById);
router.get('/:resource/:id/:child', getNestedChildren);

// === POST — Cần đăng nhập (Token) ===
router.post('/:resource', authenticate, create);

// === PUT/PATCH — Cần đăng nhập (Token) ===
router.put('/:resource/:id', authenticate, updateFull);
router.patch('/:resource/:id', authenticate, updatePartial);

// === DELETE — Chỉ admin mới được xóa ===
router.delete('/:resource/:id', authenticate, authorizeAdmin, remove);

export default router;
