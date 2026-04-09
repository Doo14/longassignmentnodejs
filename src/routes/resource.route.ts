
import { Router, RequestHandler } from 'express';
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


router.get('/:resource', getAll as RequestHandler);
router.get('/:resource/:id', getById as RequestHandler);
router.get('/:resource/:id/:child', getNestedChildren as RequestHandler);

// === POST — Cần đăng nhập (Token) ===
router.post('/:resource', authenticate as RequestHandler, create as RequestHandler);

// === PUT/PATCH — Cần đăng nhập (Token) ===
router.put('/:resource/:id', authenticate as RequestHandler, updateFull as RequestHandler);
router.patch('/:resource/:id', authenticate as RequestHandler, updatePartial as RequestHandler);

// === DELETE — Chỉ admin mới được xóa ===
router.delete(
  '/:resource/:id', 
  authenticate as RequestHandler, 
  authorizeAdmin as RequestHandler, 
  remove as RequestHandler
);

export default router;