// src/utils/tableValidator.ts
// Kiểm tra tên bảng có tồn tại trong database không
// Đây là LỚP BẢO VỆ ĐẦU TIÊN chống SQL Injection

import { db } from '../db/knex';

/**
 * Kiểm tra xem tên bảng có tồn tại trong database không
 *
 * TẠI SAO CẦN HÀM NÀY?
 * - Parameterized query (knex tự làm) bảo vệ được VALUES
 * - Nhưng KHÔNG bảo vệ được TABLE NAME và COLUMN NAME
 * - VD: SELECT * FROM ${userInput} → hacker có thể inject: "; DROP TABLE users --"
 * - Giải pháp: Query information_schema (bảng metadata của Postgres) để whitelist
 *
 * @param tableName - Tên bảng cần kiểm tra (lấy từ URL params)
 * @returns true nếu bảng tồn tại, false nếu không
 */
export async function tableExists(tableName: string): Promise<boolean> {
  // information_schema.tables chứa danh sách TẤT CẢ các bảng trong database
  // table_schema = 'public' → chỉ lấy bảng do user tạo (không lấy bảng hệ thống)
  const result = await db('information_schema.tables')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .count('table_name as count')
    .first();

  return Number(result?.count) > 0;
}
