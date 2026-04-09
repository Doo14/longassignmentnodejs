import { Request } from 'express';

export interface CustomRequest extends Request {
  tableName?: string;
}

export type DbRecord = Record<string, unknown>;

export interface ColumnDef {
  type: 'string' | 'number' | 'boolean';
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  references?: string;
}

export interface TableDef {
  columns: Record<string, ColumnDef>;
  seed?: DbRecord[];
}

export type SchemaJson = Record<string, TableDef>;
