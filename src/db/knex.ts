// src/db/knex.ts
// Kết nối đến PostgreSQL thông qua knex.js (Query Builder)
// knex.js giống như NGƯỜI PHIÊN DỊCH giữa JavaScript và SQL

import knex from 'knex';
import dotenv from 'dotenv';

// Đọc file .env để lấy biến môi trường (DB_HOST, DB_PORT, ...)
dotenv.config();

/**
 * Tạo instance kết nối database
 * - client: 'pg' → dùng PostgreSQL
 * - connection: thông tin kết nối từ biến môi trường
 * - Không hardcode mật khẩu → an toàn hơn khi deploy
 */
export const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pg_json_server',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});
