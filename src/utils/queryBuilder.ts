// src/utils/queryBuilder.ts
// Xây dựng query nâng cao cho GET /:resource
// Tách riêng logic query ra khỏi controller → dễ đọc + dễ test

import { Knex } from 'knex';

// Danh sách các query param đặc biệt (không phải filter)
// → dùng để phân biệt ?_page=1 (param đặc biệt) vs ?author=A (filter)
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

// Danh sách suffix operator (VD: views_gte → operator = gte, column = views)
const OPERATORS = ['_gte', '_lte', '_ne', '_like'] as const;

// ============================================================
// PAGINATION — ?_page=1&_limit=10
// ============================================================

/**
 * Thêm phân trang vào query
 *
 * VD: ?_page=2&_limit=5
 *   → OFFSET 5 LIMIT 5 (bỏ qua 5 record đầu, lấy 5 record tiếp)
 *
 * @param query - Knex query builder đang xây dựng
 * @param page - Số trang (bắt đầu từ 1)
 * @param limit - Số records mỗi trang
 * @returns Query đã thêm limit/offset
 */
export function applyPagination(
  query: Knex.QueryBuilder,
  page: number,
  limit: number
): Knex.QueryBuilder {
  const offset = (page - 1) * limit;
  return query.limit(limit).offset(offset);
}

// ============================================================
// SORTING — ?_sort=views&_order=desc
// ============================================================

/**
 * Thêm sắp xếp vào query
 *
 * Hỗ trợ multi-sort:
 *   ?_sort=author,views&_order=asc,desc
 *   → ORDER BY author ASC, views DESC
 *
 * @param query - Knex query builder
 * @param sortParam - Chuỗi tên cột (phân cách bằng dấu phẩy)
 * @param orderParam - Chuỗi thứ tự (phân cách bằng dấu phẩy)
 * @param validColumns - Danh sách cột hợp lệ (đã whitelist)
 * @returns Query đã thêm orderBy
 */
export function applySorting(
  query: Knex.QueryBuilder,
  sortParam: string,
  orderParam: string,
  validColumns: string[]
): Knex.QueryBuilder {
  // Tách "author,views" → ["author", "views"]
  const sortFields = sortParam.split(',').map((s) => s.trim());
  const orderFields = orderParam.split(',').map((o) => o.trim().toLowerCase());

  const orderByList: { column: string; order: 'asc' | 'desc' }[] = [];

  sortFields.forEach((field, index) => {
    // CHỈ sort theo cột hợp lệ → chống injection
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

// ============================================================
// FILTERING — ?author=Nguyen Van A&views=100
// ============================================================

/**
 * Thêm filter exact-match vào query
 *
 * Chỉ filter theo params KHÔNG nằm trong RESERVED_PARAMS
 * và KHÔNG có suffix operator (_gte, _lte, ...)
 *
 * VD: ?author=Nguyen Van A → WHERE author = 'Nguyen Van A'
 *
 * @param query - Knex query builder
 * @param queryParams - Toàn bộ query params từ request
 * @param validColumns - Danh sách cột hợp lệ
 * @returns Query đã thêm where conditions
 */
export function applyFilters(
  query: Knex.QueryBuilder,
  queryParams: Record<string, unknown>,
  validColumns: string[]
): Knex.QueryBuilder {
  for (const [key, value] of Object.entries(queryParams)) {
    // Bỏ qua params đặc biệt (_page, _sort, q, ...)
    if (RESERVED_PARAMS.includes(key)) continue;

    // Bỏ qua params có suffix operator (views_gte, views_lte, ...)
    if (OPERATORS.some((op) => key.endsWith(op))) continue;

    // CHỈ filter theo cột hợp lệ → chống injection
    if (validColumns.includes(key)) {
      query = query.where(key, value as string);
    }
  }

  return query;
}

// ============================================================
// OPERATORS — ?views_gte=100&views_lte=300&title_like=node
// ============================================================

/**
 * Thêm operator conditions vào query
 *
 * Các operator hỗ trợ:
 *   - _gte: >= (greater than or equal)
 *   - _lte: <= (less than or equal)
 *   - _ne:  != (not equal)
 *   - _like: ILIKE '%value%' (tìm kiếm không phân biệt hoa/thường)
 *
 * VD: ?views_gte=100&views_lte=300
 *   → WHERE views >= 100 AND views <= 300
 *
 * @param query - Knex query builder
 * @param queryParams - Toàn bộ query params
 * @param validColumns - Danh sách cột hợp lệ
 * @returns Query đã thêm operator conditions
 */
export function applyOperators(
  query: Knex.QueryBuilder,
  queryParams: Record<string, unknown>,
  validColumns: string[]
): Knex.QueryBuilder {
  // Map suffix → SQL operator
  const operatorMap: Record<string, string> = {
    _gte: '>=',
    _lte: '<=',
    _ne: '!=',
    _like: 'ILIKE',
  };

  for (const [key, value] of Object.entries(queryParams)) {
    for (const suffix of OPERATORS) {
      if (key.endsWith(suffix)) {
        // Tách tên cột: "views_gte" → "views"
        const column = key.slice(0, -suffix.length);

        // Kiểm tra cột hợp lệ
        if (validColumns.includes(column)) {
          const sqlOp = operatorMap[suffix];

          if (suffix === '_like') {
            // ILIKE cần wrap value với % ở 2 đầu
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

// ============================================================
// FULL-TEXT SEARCH — ?q=node
// ============================================================

/**
 * Thêm full-text search vào query
 *
 * Tìm kiếm keyword trên TẤT CẢ cột kiểu text
 * Dùng OR: chỉ cần 1 cột match là record được trả về
 *
 * VD: ?q=node → WHERE title ILIKE '%node%' OR content ILIKE '%node%' OR ...
 *
 * @param query - Knex query builder
 * @param keyword - Từ khóa tìm kiếm
 * @param textColumns - Danh sách cột text (lấy từ database metadata)
 * @returns Query đã thêm search conditions
 */
export function applySearch(
  query: Knex.QueryBuilder,
  keyword: string,
  textColumns: string[]
): Knex.QueryBuilder {
  if (textColumns.length === 0) return query;

  // Wrap trong group: WHERE (...search...) AND (...other conditions...)
  return query.where(function (this: Knex.QueryBuilder) {
    textColumns.forEach((col, index) => {
      if (index === 0) {
        this.where(col, 'ILIKE', `%${keyword}%`);
      } else {
        // OR: chỉ cần 1 cột match
        this.orWhere(col, 'ILIKE', `%${keyword}%`);
      }
    });
  });
}

/**
 * Lấy danh sách cột kiểu text từ information_schema
 * → dùng cho full-text search (chỉ search trên cột text/varchar)
 *
 * @param tableName - Tên bảng
 * @param db - Knex instance
 * @returns Mảng tên cột text
 */
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
