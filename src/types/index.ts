// src/types/index.ts
// Định nghĩa các kiểu dữ liệu tùy chỉnh cho dự án

import { Request } from 'express';

/**
 * CustomRequest — mở rộng Express Request
 * Thêm field tableName để lưu tên bảng đã được validate
 */
export interface CustomRequest extends Request {
  tableName?: string;
}

/**
 * DbRecord — đại diện cho 1 record bất kỳ trong database
 */
export type DbRecord = Record<string, unknown>;

/**
 * ColumnDef — định nghĩa 1 cột trong schema.json
 */
export interface ColumnDef {
  type: 'string' | 'number' | 'boolean';
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  references?: string;
}

/**
 * TableDef — định nghĩa 1 bảng trong schema.json
 */
export interface TableDef {
  columns: Record<string, ColumnDef>;
  seed?: DbRecord[];
}

/**
 * SchemaJson — cấu trúc của file schema.json
 */
export type SchemaJson = Record<string, TableDef>;
