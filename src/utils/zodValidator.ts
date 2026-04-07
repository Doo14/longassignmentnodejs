// src/utils/zodValidator.ts
// Dynamic Zod validation — tự sinh schema từ cấu trúc bảng database
// Validate body trước khi INSERT/UPDATE → trả lỗi chi tiết cho từng field

import { z } from 'zod';
import { db } from '../db/knex';

/**
 * Thông tin 1 cột trong database (lấy từ information_schema)
 */
interface ColumnInfo {
  column_name: string;
  data_type: string; // VD: 'text', 'integer', 'boolean', 'timestamp without time zone'
  is_nullable: string; // 'YES' hoặc 'NO'
  column_default: string | null; // VD: 'nextval(...)' cho auto-increment
}

/**
 * Lấy thông tin chi tiết các cột từ database
 *
 * TẠI SAO KHÔNG HARDCODE SCHEMA?
 * - Vì dự án này là DYNAMIC — không biết trước schema
 * - Bảng được tạo tự động từ db.json
 * - Nên phải đọc metadata từ Postgres để biết kiểu cột
 *
 * @param tableName - Tên bảng cần lấy schema
 * @returns Mảng thông tin cột
 */
async function getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
  return db('information_schema.columns')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .select('column_name', 'data_type', 'is_nullable', 'column_default');
}

/**
 * Tự động sinh Zod schema từ cấu trúc bảng database
 *
 * MAPPING KIỂU DỮ LIỆU:
 * - integer, bigint, numeric → z.number()
 * - text, character varying → z.string()
 * - boolean → z.boolean()
 * - timestamp, date → z.string() (ISO format)
 * - Còn lại → z.unknown()
 *
 * CỘT BỊ BỎ QUA:
 * - id (auto-increment → không cho client set)
 * - created_at (tự động set bởi database)
 * - updated_at (tự động set bởi app)
 *
 * @param tableName - Tên bảng
 * @param partial - true cho PATCH (tất cả field optional), false cho POST/PUT
 * @returns Zod schema object
 */
export async function buildZodSchema(
  tableName: string,
  partial: boolean = false
): Promise<z.ZodObject<Record<string, z.ZodTypeAny>>> {
  const columns = await getColumnInfo(tableName);

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of columns) {
    // Bỏ qua cột hệ thống (id auto-increment, timestamps)
    if (['id', 'created_at', 'updated_at'].includes(col.column_name)) {
      continue;
    }

    // Map PostgreSQL data type → Zod type
    let zodType: z.ZodTypeAny;

    switch (col.data_type) {
      case 'integer':
      case 'bigint':
      case 'smallint':
      case 'numeric':
      case 'real':
      case 'double precision':
        zodType = z.number({ message: `${col.column_name} phải là số` });
        break;

      case 'text':
      case 'character varying':
      case 'character':
        zodType = z.string({ message: `${col.column_name} phải là chuỗi` });
        break;

      case 'boolean':
        zodType = z.boolean({
          message: `${col.column_name} phải là true/false`,
        });
        break;

      case 'timestamp without time zone':
      case 'timestamp with time zone':
      case 'date':
        zodType = z.string({
          message: `${col.column_name} phải là chuỗi ngày tháng`,
        });
        break;

      default:
        zodType = z.unknown();
    }

    // PATCH → tất cả field optional
    // POST/PUT → field optional nếu column nullable hoặc có default value
    if (partial || col.is_nullable === 'YES' || col.column_default !== null) {
      zodType = zodType.optional();
    }

    shape[col.column_name] = zodType;
  }

  return z.object(shape);
}

/**
 * Validate body request bằng Zod schema tự sinh
 *
 * @param tableName - Tên bảng
 * @param body - Body từ request
 * @param partial - true cho PATCH
 * @returns { success: true, data } hoặc { success: false, errors }
 */
export async function validateBody(
  tableName: string,
  body: Record<string, unknown>,
  partial: boolean = false
): Promise<
  | { success: true; data: Record<string, unknown> }
  | { success: false; errors: z.ZodIssue[] }
> {
  const schema = await buildZodSchema(tableName, partial);

  // passthrough(): cho phép field không có trong schema
  // → vì có thể client gửi field 'id' (ta sẽ loại bỏ sau)
  const result = schema.passthrough().safeParse(body);

  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
  }

  return { success: false, errors: result.error.issues };
}
