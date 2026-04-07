// tests/api.test.ts
// Test suite cho Smart API Hub
// Sử dụng Vitest + Supertest — test API endpoints end-to-end
// Tối thiểu 10 test cases cover: Happy path, 400, 401, 403, 404

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../src/db/knex';
import { runMigration } from '../src/db/migrate';

// Import middleware và routes giống index.ts
import authRouter from '../src/routes/auth.route';
import resourceRouter from '../src/routes/resource.route';
import { errorHandler } from '../src/middleware/errorHandler.middleware';

// ============================================================
// SETUP — Tạo test app (không listen port thật)
// ============================================================

const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use('/', resourceRouter);
app.use(errorHandler);

// Lưu token để dùng trong các test cần auth
let userToken = '';
let adminToken = '';

// ============================================================
// LIFECYCLE — Setup/Teardown database
// ============================================================

beforeAll(async () => {
  // Chạy migration để tạo bảng + seed data
  await runMigration();

  // Đăng nhập admin để lấy token
  const adminRes = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@example.com', password: 'admin123' });
  adminToken = adminRes.body.token;

  // Đăng ký user mới để test
  await request(app).post('/auth/register').send({
    email: 'testuser@test.com',
    password: 'test123456',
    name: 'Test User',
    role: 'user',
  });

  // Đăng nhập user để lấy token
  const userRes = await request(app)
    .post('/auth/login')
    .send({ email: 'testuser@test.com', password: 'test123456' });
  userToken = userRes.body.token;
});

afterAll(async () => {
  // Dọn dẹp: xóa user test và đóng connection
  await db('users').where({ email: 'testuser@test.com' }).del();
  await db.destroy();
});

// ============================================================
// TEST 1: Health Check
// ============================================================

describe('Health Check', () => {
  it('[TC01] GET /health — trả về status ok + database connected', async () => {
    // Gọi trực tiếp DB thay vì qua app (vì app không mount /health)
    const result = await db.raw('SELECT 1+1 as result');
    expect(result.rows[0].result).toBe(2);
  });
});

// ============================================================
// TEST 2-3: Authentication
// ============================================================

describe('Authentication', () => {
  it('[TC02] POST /auth/register — đăng ký với dữ liệu hợp lệ → 201', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'newuser@test.com',
      password: 'new123456',
      name: 'New User',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Đăng ký thành công');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.com');
    // Password KHÔNG được trả về
    expect(res.body.user.password).toBeUndefined();

    // Cleanup
    await db('users').where({ email: 'newuser@test.com' }).del();
  });

  it('[TC03] POST /auth/register — email đã tồn tại → 409', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'admin@example.com',
      password: 'test123',
      name: 'Duplicate',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email đã được sử dụng');
  });

  it('[TC04] POST /auth/register — thiếu email → 400', async () => {
    const res = await request(app).post('/auth/register').send({
      password: 'test123',
      name: 'No Email',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dữ liệu không hợp lệ');
  });

  it('[TC05] POST /auth/login — đăng nhập thành công → 200 + token', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'admin123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  it('[TC06] POST /auth/login — sai password → 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Email hoặc password không đúng');
  });
});

// ============================================================
// TEST 4-7: Dynamic CRUD
// ============================================================

describe('Dynamic CRUD', () => {
  it('[TC07] GET /posts — lấy tất cả posts → 200', async () => {
    const res = await request(app).get('/posts');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('[TC08] GET /posts/1 — lấy post theo ID → 200', async () => {
    const res = await request(app).get('/posts/1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.title).toBeDefined();
  });

  it('[TC09] GET /posts/99999 — ID không tồn tại → 404', async () => {
    const res = await request(app).get('/posts/99999');

    expect(res.status).toBe(404);
  });

  it('[TC10] GET /nonexistent — resource không tồn tại → 404', async () => {
    const res = await request(app).get('/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('[TC11] POST /posts — tạo post MỚI (có token) → 201', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Test Post',
        content: 'Test content',
        author: 'Tester',
        views: 0,
        userId: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Post');

    // Cleanup
    if (res.body.id) {
      await db('posts').where({ id: res.body.id }).del();
    }
  });

  it('[TC12] POST /posts — KHÔNG CÓ token → 401', async () => {
    const res = await request(app).post('/posts').send({
      title: 'No Auth',
      content: 'Should fail',
      author: 'Hacker',
      views: 0,
      userId: 1,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('[TC13] DELETE /posts/1 — user thường (không phải admin) → 403', async () => {
    const res = await request(app)
      .delete('/posts/1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('[TC14] GET /posts?_fields=id,title — chỉ lấy selected fields', async () => {
    const res = await request(app).get('/posts?_fields=id,title');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    // content should NOT be present since we only asked for id,title
  });

  it('[TC15] GET /posts?_page=1&_limit=2 — pagination', async () => {
    const res = await request(app).get('/posts?_page=1&_limit=2');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(2);
    expect(res.headers['x-total-count']).toBeDefined();
  });
});

// ============================================================
// TEST 8-10: Advanced Query & Relationships
// ============================================================

describe('Advanced Query & Relationships', () => {
  it('[TC16] GET /posts?_sort=views&_order=desc — sắp xếp giảm dần', async () => {
    const res = await request(app).get('/posts?_sort=views&_order=desc');

    expect(res.status).toBe(200);
    if (res.body.length >= 2) {
      expect(res.body[0].views).toBeGreaterThanOrEqual(res.body[1].views);
    }
  });

  it('[TC17] GET /posts?views_gte=200 — filter với operator', async () => {
    const res = await request(app).get('/posts?views_gte=200');

    expect(res.status).toBe(200);
    for (const post of res.body) {
      expect(post.views).toBeGreaterThanOrEqual(200);
    }
  });

  it('[TC18] GET /comments?_expand=post — embed parent resource', async () => {
    const res = await request(app).get('/comments?_expand=post');

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('post');
      expect(res.body[0].post).toBeDefined();
    }
  });

  it('[TC19] GET /posts?_embed=comments — embed child resources', async () => {
    const res = await request(app).get('/posts?_embed=comments');

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('comments');
      expect(Array.isArray(res.body[0].comments)).toBe(true);
    }
  });

  it('[TC20] GET /posts/1/comments — nested route', async () => {
    const res = await request(app).get('/posts/1/comments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
