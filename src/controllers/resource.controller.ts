
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


export async function getAll(
  req: Request<{ resource: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource } = req.params;

    if (!(await tableExists(resource))) {
      res.status(404).json({ error: `Resource '${resource}' not found` });
      return;
    }

    const validColumns = await getTableColumns(resource);
    let query = db(resource);

    // Xử lý _fields
    const fieldsParam = req.query._fields as string | undefined;
    if (fieldsParam) {
      const fields = fieldsParam.split(',').map((f) => f.trim()).filter(f => validColumns.includes(f));
      query = query.select(fields.length > 0 ? fields : '*');
    } else {
      query = query.select('*');
    }

    const queryParams = req.query as Record<string, unknown>;
    query = applyFilters(query, queryParams, validColumns);
    query = applyOperators(query, queryParams, validColumns);

    const searchKeyword = req.query.q as string | undefined;
    if (searchKeyword) {
      const textCols = await getTextColumns(resource, db);
      query = applySearch(query, searchKeyword, textCols);
    }

    const sortParam = req.query._sort as string | undefined;
    if (sortParam) {
      const orderParam = (req.query._order as string) || 'asc';
      query = applySorting(query, sortParam, orderParam, validColumns);
    }

    // Phân trang
    const pageParam = req.query._page as string | undefined;
    if (pageParam) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = Math.max(1, parseInt((req.query._limit as string) || '10', 10));
      
      const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
      const countResult = await countQuery;
      const total = Number((countResult as any)?.total || 0);

      res.set('X-Total-Count', String(total));
      res.set('Access-Control-Expose-Headers', 'X-Total-Count');
      query = applyPagination(query, page, limit);
    }

    let data = await query;

    const expandParam = req.query._expand as string | undefined;
    if (expandParam) data = await expandRelation(data, resource, expandParam);

    const embedParam = req.query._embed as string | undefined;
    if (embedParam) data = await embedRelation(data, resource, embedParam);

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}


export async function getById(
  req: Request<{ resource: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource, id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'ID không hợp lệ' });
      return;
    }

    const item = await db(resource).where({ id }).first();
    if (!item) {
      res.status(404).json({ error: 'Không tìm thấy dữ liệu' });
      return;
    }

    let result = [item];
    const expandParam = req.query._expand as string | undefined;
    if (expandParam) result = await expandRelation(result, resource, expandParam);

    const embedParam = req.query._embed as string | undefined;
    if (embedParam) result = await embedRelation(result, resource, embedParam);

    res.status(200).json(result[0]);
  } catch (error) {
    next(error);
  }
}


export async function create(
  req: Request<{ resource: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { resource } = req.params;
    const body = req.body;

    if (isEmptyBody(body)) {
      res.status(400).json({ error: 'Body không được rỗng' });
      return;
    }

    const validation = await validateBody(resource, body, false);
    if (!validation.success) {
      res.status(400).json({ error: 'Dữ liệu không hợp lệ', details: validation.errors });
      return;
    }

    const [newRecord] = await db(resource).insert(validation.data).returning('*');
    res.status(201).json(newRecord);
  } catch (error) {
    next(error);
  }
}

export async function updateFull(req: Request<any>, res: Response, next: NextFunction) {
  try {
    const { resource, id } = req.params;
    const validation = await validateBody(resource, req.body, false);
    if (!validation.success) return res.status(400).json({ errors: validation.errors });

    const [updated] = await db(resource).where({ id }).update({ ...validation.data, updated_at: new Date() }).returning('*');
    updated ? res.json(updated) : res.status(404).json({ error: 'Not found' });
  } catch (e) { next(e); }
}


export async function updatePartial(req: Request<any>, res: Response, next: NextFunction) {
  try {
    const { resource, id } = req.params;
    const validation = await validateBody(resource, req.body, true);
    if (!validation.success) return res.status(400).json({ errors: validation.errors });

    const [updated] = await db(resource).where({ id }).update({ ...validation.data, updated_at: new Date() }).returning('*');
    updated ? res.json(updated) : res.status(404).json({ error: 'Not found' });
  } catch (e) { next(e); }
}


export async function remove(req: Request<any>, res: Response, next: NextFunction) {
  try {
    const { resource, id } = req.params;
    const deleted = await db(resource).where({ id }).del();
    deleted ? res.status(204).send() : res.status(404).json({ error: 'Not found' });
  } catch (e) { next(e); }
}


export async function getNestedChildren(req: Request<any>, res: Response, next: NextFunction) {
  try {
    const { resource, id, child } = req.params;
    const foreignKey = toSingular(resource) + 'Id';
    const data = await db(child).where(foreignKey, id);
    res.json(data);
  } catch (e) { next(e); }
}


async function expandRelation(data: any[], _current: string, parentResource: string) {
  const parentTable = parentResource + 's';
  const foreignKey = parentResource + 'Id';
  if (!(await tableExists(parentTable))) return data;

  const parentIds = [...new Set(data.map(r => r[foreignKey]).filter(id => id != null))];
  if (parentIds.length === 0) return data;

  const parents = await db(parentTable).whereIn('id', parentIds);
  const parentMap = new Map(parents.map((p: any) => [p.id, p]));

  return data.map(record => ({
    ...record,
    [parentResource]: parentMap.get(record[foreignKey]) || null
  }));
}

async function embedRelation(data: any[], currentResource: string, childResource: string) {
  if (!(await tableExists(childResource))) return data;
  const foreignKey = toSingular(currentResource) + 'Id';
  const childColumns = await getTableColumns(childResource);
  if (!childColumns.includes(foreignKey)) return data;

  const parentIds = data.map(r => r.id).filter(id => id != null);
  if (parentIds.length === 0) return data;

  const children = await db(childResource).whereIn(foreignKey, parentIds);
  const childrenMap = new Map();
  children.forEach((child: any) => {
    const pid = child[foreignKey];
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(child);
  });

  return data.map(record => ({
    ...record,
    [childResource]: childrenMap.get(record.id) || []
  }));
}

function toSingular(plural: string): string {
  return plural.endsWith('s') ? plural.slice(0, -1) : plural;
}