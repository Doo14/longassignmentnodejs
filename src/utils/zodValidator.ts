

import { z } from 'zod';
import { db } from '../db/knex';

interface ColumnInfo {
  column_name: string;
  data_type: string; 
  is_nullable: string; 
  column_default: string | null; 
}


async function getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
  return db('information_schema.columns')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .select('column_name', 'data_type', 'is_nullable', 'column_default');
}


export async function buildZodSchema(
  tableName: string,
  partial: boolean = false
): Promise<z.ZodObject<Record<string, z.ZodTypeAny>>> {
  const columns = await getColumnInfo(tableName);

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of columns) {

    if (['id', 'created_at', 'updated_at'].includes(col.column_name)) {
      continue;
    }

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

    if (partial || col.is_nullable === 'YES' || col.column_default !== null) {
      zodType = zodType.optional();
    }

    shape[col.column_name] = zodType;
  }

  return z.object(shape);
}


export async function validateBody(
  tableName: string,
  body: Record<string, unknown>,
  partial: boolean = false
): Promise<
  | { success: true; data: Record<string, unknown> }
  | { success: false; errors: z.ZodIssue[] }
> {
  const schema = await buildZodSchema(tableName, partial);

  const result = schema.passthrough().safeParse(body);

  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
  }

  return { success: false, errors: result.error.issues };
}
