

import { Knex } from 'knex';


const RESERVED_PARAMS = [
  '_page',
  '_limit',
  '_sort',
  '_order',
  '_fields',
  '_expand',
  '_embed',
  'q',
];

const OPERATORS = ['_gte', '_lte', '_ne', '_like'] as const;


export function applyPagination(
  query: Knex.QueryBuilder,
  page: number,
  limit: number
): Knex.QueryBuilder {
  const offset = (page - 1) * limit;
  return query.limit(limit).offset(offset);
}




 
export function applySorting(
  query: Knex.QueryBuilder,
  sortParam: string,
  orderParam: string,
  validColumns: string[]
): Knex.QueryBuilder {
  const sortFields = sortParam.split(',').map((s) => s.trim());
  const orderFields = orderParam.split(',').map((o) => o.trim().toLowerCase());

  const orderByList: { column: string; order: 'asc' | 'desc' }[] = [];

  sortFields.forEach((field, index) => {
    if (validColumns.includes(field)) {
      const order = orderFields[index] === 'desc' ? 'desc' : 'asc';
      orderByList.push({ column: field, order });
    }
  });

  if (orderByList.length > 0) {
    return query.orderBy(orderByList);
  }

  return query;
}

export function applyFilters(
  query: Knex.QueryBuilder,
  queryParams: Record<string, unknown>,
  validColumns: string[]
): Knex.QueryBuilder {
  for (const [key, value] of Object.entries(queryParams)) {
    if (RESERVED_PARAMS.includes(key)) continue;

    if (OPERATORS.some((op) => key.endsWith(op))) continue;

    if (validColumns.includes(key)) {
      query = query.where(key, value as string);
    }
  }

  return query;
}


export function applyOperators(
  query: Knex.QueryBuilder,
  queryParams: Record<string, unknown>,
  validColumns: string[]
): Knex.QueryBuilder {
  const operatorMap: Record<string, string> = {
    _gte: '>=',
    _lte: '<=',
    _ne: '!=',
    _like: 'ILIKE',
  };

  for (const [key, value] of Object.entries(queryParams)) {
    for (const suffix of OPERATORS) {
      if (key.endsWith(suffix)) {
        const column = key.slice(0, -suffix.length);

        if (validColumns.includes(column)) {
          const sqlOp = operatorMap[suffix];

          if (suffix === '_like') {
            query = query.where(column, sqlOp, `%${value}%`);
          } else {
            query = query.where(column, sqlOp, value as string);
          }
        }
      }
    }
  }

  return query;
}


export function applySearch(
  query: Knex.QueryBuilder,
  keyword: string,
  textColumns: string[]
): Knex.QueryBuilder {
  if (textColumns.length === 0) return query;

  return query.where(function (this: Knex.QueryBuilder) {
    textColumns.forEach((col, index) => {
      if (index === 0) {
        this.where(col, 'ILIKE', `%${keyword}%`);
      } else {
        this.orWhere(col, 'ILIKE', `%${keyword}%`);
      }
    });
  });
}


export async function getTextColumns(
  tableName: string,
  dbInstance: Knex
): Promise<string[]> {
  const rows = await dbInstance('information_schema.columns')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .whereIn('data_type', ['text', 'character varying'])
    .select('column_name');

  return rows.map((r: { column_name: string }) => r.column_name);
}
