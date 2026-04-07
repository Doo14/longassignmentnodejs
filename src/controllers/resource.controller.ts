// src/controllers/resource.controller.ts
// Controller xử lý logic cho các route động (dynamic routes)
// Buổi 3: CRUD cơ bản | Buổi 4: Advanced query | Buổi 5: Zod validation | Buổi 6: Relationships

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/knex';
import { tableExists } from '../utils/tableValidator';
import { getTableColumns } from '../utils/columnValidator';
import { isValidId, isEmptyBody } from '../utils/validate';
import { validateBody } from '../utils/zodValidator';
import {
  applyPagination,
  applySorting,
  applyFilters,
  applyOperators,
  applySearch,
  getTextColumns,
} from '../utils/queryBuilder';

// ============================================================
// GET /:resource — Lấy tất cả records (Buổi 3 + 4)
// ============================================================

/**
 * GET /:resource — Lấy tất cả records với advanced query
 *
 * Query params hỗ trợ:
 *   ?_fields=id,title       → chọn cột (Buổi 3)
 *   ?_page=1&_limit=10      → phân trang (Buổi 4)
 *   ?_sort=views&_order=desc → sắp xếp (Buổi 4)
 *   ?author=Nguyen Van A    → filter exact match (Buổi 4)
 *   ?views_gte=100          → filter với operator (Buổi 4)
 *   ?q=node                 → full-text search (Buổi 4)
 *   ?_expand=post           → embed parent (Buổi 6)
 *   ?_embed=comments        → embed children (Buổi 6)
 */
export async function getAll(
  req: Request<{ resource: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource } = req.params;

    // Bước 1: Kiểm tra bảng tồn tại → chống SQL Injection
    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    // Bước 2: Lấy danh sách cột hợp lệ → whitelist cho sort/filter
    const validColumns = await getTableColumns(resource);

    // Bước 3: Xử lý _fields — chọn cột cụ thể
    const fieldsParam = req.query._fields as string | undefined;
    let query = db(resource);

    if (fieldsParam) {
      const fields = fieldsParam
        .split(',')
        .map((f) => f.trim())
        .filter((f) => validColumns.includes(f)); // Chỉ cho cột hợp lệ
      query = fields.length > 0 ? query.select(fields) : query.select('*');
    } else {
      query = query.select('*');
    }

    // Bước 4: FILTERING — ?author=Nguyen Van A (Buổi 4)
    const queryParams = req.query as Record<string, unknown>;
    query = applyFilters(query, queryParams, validColumns);

    // Bước 5: OPERATORS — ?views_gte=100&views_lte=300 (Buổi 4)
    query = applyOperators(query, queryParams, validColumns);

    // Bước 6: FULL-TEXT SEARCH — ?q=node (Buổi 4)
    const searchKeyword = req.query.q as string | undefined;
    if (searchKeyword) {
      const textCols = await getTextColumns(resource, db);
      query = applySearch(query, searchKeyword, textCols);
    }

    // Bước 7: SORTING — ?_sort=views&_order=desc (Buổi 4)
    const sortParam = req.query._sort as string | undefined;
    if (sortParam) {
      const orderParam = (req.query._order as string) || 'asc';
      query = applySorting(query, sortParam, orderParam, validColumns);
    }

    // Bước 8: PAGINATION — ?_page=1&_limit=10 (Buổi 4)
    const pageParam = req.query._page as string | undefined;
    if (pageParam) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = Math.max(1, parseInt((req.query._limit as string) || '10', 10));

      // Đếm tổng số records (trước khi limit)
      // Clone query conditions nhưng dùng count thay vì select
      const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
      const countResult = await countQuery;
      const total = Number((countResult as Record<string, unknown>)?.total || 0);

      // Set response headers
      res.set('X-Total-Count', String(total));
      res.set('Access-Control-Expose-Headers', 'X-Total-Count, Link');

      // Tạo Link header (pagination navigation)
      const totalPages = Math.ceil(total / limit);
      const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
      const links: string[] = [];

      if (page > 1) {
        links.push(`<${baseUrl}?_page=1&_limit=${limit}>; rel="first"`);
        links.push(`<${baseUrl}?_page=${page - 1}&_limit=${limit}>; rel="prev"`);
      }
      if (page < totalPages) {
        links.push(`<${baseUrl}?_page=${page + 1}&_limit=${limit}>; rel="next"`);
        links.push(`<${baseUrl}?_page=${totalPages}&_limit=${limit}>; rel="last"`);
      }

      if (links.length > 0) {
        res.set('Link', links.join(', '));
      }

      // Áp dụng pagination
      query = applyPagination(query, page, limit);
    }

    // Bước 9: Thực thi query
    let data = await query;

    // Bước 10: EXPAND — ?_expand=post (Buổi 6)
    // Khi GET /comments?_expand=post → embed thông tin post vào mỗi comment
    const expandParam = req.query._expand as string | undefined;
    if (expandParam) {
      data = await expandRelation(data, resource, expandParam);
    }

    // Bước 11: EMBED — ?_embed=comments (Buổi 6)
    // Khi GET /posts?_embed=comments → embed mảng comments vào mỗi post
    const embedParam = req.query._embed as string | undefined;
    if (embedParam) {
      data = await embedRelation(data, resource, embedParam);
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET /:resource/:id — Lấy 1 record theo ID
// ============================================================

/**
 * GET /:resource/:id — Lấy 1 record theo ID
 *
 * Hỗ trợ _expand và _embed giống getAll (Buổi 6)
 */
export async function getById(
  req: Request<{ resource: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id } = req.params;

    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID phải là số nguyên dương hợp lệ' });
      return;
    }

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    const item = await db(resource).where({ id: Number(id) }).first();

    if (!item) {
      res
        .status(404)
        .json({ error: `${resource} với id=${id} không tồn tại` });
      return;
    }

    // Expand — embed parent object (Buổi 6)
    let result = item;
    const expandParam = req.query._expand as string | undefined;
    if (expandParam) {
      const expanded = await expandRelation([item], resource, expandParam);
      result = expanded[0];
    }

    // Embed — embed children array (Buổi 6)
    const embedParam = req.query._embed as string | undefined;
    if (embedParam) {
      const embedded = await embedRelation([result], resource, embedParam);
      result = embedded[0];
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET /:resource/:id/:child — Nested route (Buổi 6)
// ============================================================

/**
 * GET /:resource/:id/:child — Lấy tất cả child records
 *
 * VD: GET /posts/1/comments
 *   → Lấy tất cả comments có postId = 1
 *
 * Quy tắc: Tên cột foreign key = parentSingular + "Id"
 *   VD: posts → postId, users → userId
 */
export async function getNestedChildren(
  req: Request<{ resource: string; id: string; child: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id, child } = req.params;

    // Validate ID
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID phải là số nguyên dương hợp lệ' });
      return;
    }

    // Kiểm tra bảng parent tồn tại
    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    // Kiểm tra bảng child tồn tại
    if (!(await tableExists(child))) {
      res.status(404).json({ error: `Resource '${child}' not found` });
      return;
    }

    // Kiểm tra parent record tồn tại
    const parent = await db(resource).where({ id: Number(id) }).first();
    if (!parent) {
      res
        .status(404)
        .json({ error: `${resource} với id=${id} không tồn tại` });
      return;
    }

    // Tạo foreign key: "posts" → "postId" (bỏ 's' cuối + thêm 'Id')
    const foreignKey = toSingular(resource) + 'Id';

    // Kiểm tra cột foreign key tồn tại trong bảng child
    const childColumns = await getTableColumns(child);
    if (!childColumns.includes(foreignKey)) {
      res.status(400).json({
        error: `Bảng '${child}' không có cột '${foreignKey}'`,
      });
      return;
    }

    // Query children
    const children = await db(child).where(foreignKey, Number(id));
    res.status(200).json(children);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// POST /:resource — Tạo mới 1 record (Buổi 3 + 5)
// ============================================================

/**
 * POST /:resource — Tạo mới 1 record
 *
 * Buổi 5: Thêm Zod validation trước khi INSERT
 */
export async function create(
  req: Request<{ resource: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource } = req.params;
    const body = req.body as Record<string, unknown>;

    if (isEmptyBody(body)) {
      res.status(400).json({ error: 'Body không được rỗng' });
      return;
    }

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    // Buổi 5: Zod validation — kiểm tra kiểu dữ liệu
    const validation = await validateBody(resource, body, false);
    if (!validation.success) {
      res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: validation.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    // Loại bỏ field 'id' (auto-increment)
    const { id, ...dataToInsert } = body;

    const [newRecord] = await db(resource)
      .insert(dataToInsert)
      .returning('*');

    res.status(201).json(newRecord);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// PUT /:resource/:id — Cập nhật toàn bộ (Buổi 3 + 5)
// ============================================================

/**
 * PUT /:resource/:id — Cập nhật TOÀN BỘ fields
 *
 * Buổi 5: Thêm Zod validation
 */
export async function updateFull(
  req: Request<{ resource: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id } = req.params;
    const body = req.body as Record<string, unknown>;

    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID phải là số nguyên dương hợp lệ' });
      return;
    }

    if (isEmptyBody(body)) {
      res.status(400).json({ error: 'Body không được rỗng' });
      return;
    }

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    // Buổi 5: Zod validation
    const validation = await validateBody(resource, body, false);
    if (!validation.success) {
      res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: validation.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const existing = await db(resource).where({ id: Number(id) }).first();
    if (!existing) {
      res
        .status(404)
        .json({ error: `${resource} với id=${id} không tồn tại` });
      return;
    }

    const { id: _id, created_at, ...dataToUpdate } = body;

    const updatePayload = {
      ...dataToUpdate,
      updated_at: new Date(),
    };

    const [updatedRecord] = await db(resource)
      .where({ id: Number(id) })
      .update(updatePayload)
      .returning('*');

    res.status(200).json(updatedRecord);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// PATCH /:resource/:id — Cập nhật 1 phần (Buổi 3 + 5)
// ============================================================

/**
 * PATCH /:resource/:id — Cập nhật MỘT PHẦN fields
 *
 * Buổi 5: Zod validation với partial=true (tất cả field optional)
 */
export async function updatePartial(
  req: Request<{ resource: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id } = req.params;
    const body = req.body as Record<string, unknown>;

    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID phải là số nguyên dương hợp lệ' });
      return;
    }

    if (isEmptyBody(body)) {
      res.status(400).json({ error: 'Body không được rỗng' });
      return;
    }

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    // Buổi 5: Zod validation với partial=true
    const validation = await validateBody(resource, body, true);
    if (!validation.success) {
      res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: validation.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    const existing = await db(resource).where({ id: Number(id) }).first();
    if (!existing) {
      res
        .status(404)
        .json({ error: `${resource} với id=${id} không tồn tại` });
      return;
    }

    const { id: _id, created_at, ...dataToUpdate } = body;

    const updatePayload = {
      ...dataToUpdate,
      updated_at: new Date(),
    };

    const [updatedRecord] = await db(resource)
      .where({ id: Number(id) })
      .update(updatePayload)
      .returning('*');

    res.status(200).json(updatedRecord);
  } catch (error) {
    next(error);
  }
}

// ============================================================
// DELETE /:resource/:id — Xóa 1 record
// ============================================================

/**
 * DELETE /:resource/:id — Xóa 1 record khỏi database
 * Response: 204 No Content
 */
export async function remove(
  req: Request<{ resource: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id } = req.params;

    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID phải là số nguyên dương hợp lệ' });
      return;
    }

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    const existing = await db(resource).where({ id: Number(id) }).first();
    if (!existing) {
      res
        .status(404)
        .json({ error: `${resource} với id=${id} không tồn tại` });
      return;
    }

    await db(resource).where({ id: Number(id) }).del();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================
// HELPER FUNCTIONS — Relationships (Buổi 6)
// ============================================================

/**
 * Expand — embed parent object vào mỗi record
 *
 * VD: GET /comments?_expand=post
 * → Mỗi comment có cột postId → tìm post có id = postId → embed vào field "post"
 *
 * Input:  [{ id: 1, postId: 1, body: "..." }]
 * Output: [{ id: 1, postId: 1, body: "...", post: { id: 1, title: "..." } }]
 */
async function expandRelation(
  data: Record<string, unknown>[],
  _currentResource: string,
  parentResource: string
): Promise<Record<string, unknown>[]> {
  // parentResource = "post" → table = "posts" (thêm 's')
  const parentTable = parentResource + 's';
  const foreignKey = parentResource + 'Id';

  // Kiểm tra bảng parent tồn tại
  if (!(await tableExists(parentTable))) {
    return data; // Không tìm thấy bảng → trả về data gốc
  }

  // Thu thập tất cả parent IDs duy nhất
  const parentIds = [
    ...new Set(
      data
        .map((r) => r[foreignKey])
        .filter((id) => id !== undefined && id !== null)
    ),
  ];

  if (parentIds.length === 0) return data;

  // Query tất cả parent records 1 lần (tối ưu N+1)
  const parents = await db(parentTable).whereIn('id', parentIds as number[]);

  // Tạo lookup map: id → parent record
  const parentMap = new Map<number, Record<string, unknown>>();
  for (const p of parents) {
    parentMap.set(p.id as number, p);
  }

  // Embed parent vào mỗi record
  return data.map((record) => ({
    ...record,
    [parentResource]: parentMap.get(record[foreignKey] as number) || null,
  }));
}

/**
 * Embed — embed children array vào mỗi record
 *
 * VD: GET /posts?_embed=comments
 * → Mỗi post → tìm comments có postId = post.id → embed vào field "comments"
 *
 * Input:  [{ id: 1, title: "..." }]
 * Output: [{ id: 1, title: "...", comments: [{ id: 1, postId: 1, body: "..." }] }]
 */
async function embedRelation(
  data: Record<string, unknown>[],
  currentResource: string,
  childResource: string
): Promise<Record<string, unknown>[]> {
  // Kiểm tra bảng child tồn tại
  if (!(await tableExists(childResource))) {
    return data;
  }

  // Foreign key: "posts" → "postId"
  const foreignKey = toSingular(currentResource) + 'Id';

  // Kiểm tra bảng child có cột foreign key
  const childColumns = await getTableColumns(childResource);
  if (!childColumns.includes(foreignKey)) {
    return data;
  }

  // Thu thập tất cả parent IDs
  const parentIds = data
    .map((r) => r.id)
    .filter((id) => id !== undefined && id !== null) as number[];

  if (parentIds.length === 0) return data;

  // Query tất cả children 1 lần
  const children = await db(childResource).whereIn(foreignKey, parentIds);

  // Group children by parentId
  const childrenMap = new Map<number, Record<string, unknown>[]>();
  for (const child of children) {
    const parentId = child[foreignKey] as number;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(child);
  }

  // Embed children vào mỗi record
  return data.map((record) => ({
    ...record,
    [childResource]: childrenMap.get(record.id as number) || [],
  }));
}

/**
 * Chuyển tên bảng số nhiều → số ít (đơn giản)
 * VD: "posts" → "post", "comments" → "comment", "users" → "user"
 *
 * Quy tắc đơn giản: bỏ chữ 's' cuối cùng
 * (Không xử lý trường hợp phức tạp: "categories" → "category")
 */
function toSingular(plural: string): string {
  if (plural.endsWith('s')) {
    return plural.slice(0, -1);
  }
  return plural;
}
