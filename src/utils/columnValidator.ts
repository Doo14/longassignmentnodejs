

import { db } from '../db/knex';


export async function getTableColumns(tableName: string): Promise<string[]> {
  const rows = await db('information_schema.columns')
    .where({
      table_schema: 'public',
      table_name: tableName,
    })
    .select('column_name');

  return rows.map((r: { column_name: string }) => r.column_name);
}


export function isValidColumn(
  column: string,
  validColumns: string[]
): boolean {
  return validColumns.includes(column);
}
