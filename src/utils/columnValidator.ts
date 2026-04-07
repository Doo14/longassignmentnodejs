// src/utils/columnValidator.ts
// Lấy danh sách cột hợp lệ từ database — chống SQL Injection cho tên cột
// Dùng cho: _sort, _fields, filter params, operators

import { db } from '../db/knex';

/**
 * Lấy danh sách tên cột của 1 bảng từ information_schema
 *
 * TẠI SAO CẦN HÀM NÀY?
 * - Khi client gửi ?_sort=views hoặc ?author=xxx
 *   → ta cần KIỂM TRA "views" và "author" có phải tên cột thật không
 * - Nếu không kiểm tra → hacker có thể inject: ?_sort=1; DROP TABLE users--
 * - information_schema.columns là bảng metadata chứa tên cột thật
 *
 * @param tableName - Tên bảng cần lấy danh sách cột
 * @returns Mảng tên cột (VD: ["id", "title", "content", "author", "views"])
 */
export async function getTableColumns(tableName: string): Promise<string[]> {
  const rows = await db('information_schema.columns')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .select('column_name');

  return rows.map((r: { column_name: string }) => r.column_name);
}

/**
 * Kiểm tra xem tên cột có hợp lệ không
 * → dùng để whitelist tên cột trước khi đưa vào query
 *
 * @param column - Tên cột cần kiểm tra
 * @param validColumns - Danh sách cột hợp lệ từ getTableColumns()
 * @returns true nếu cột tồn tại, false nếu không
 */
export function isValidColumn(
  column: string,
  validColumns: string[]
): boolean {
  return validColumns.includes(column);
}
