
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db } from './knex';


interface ColumnDef {
  type: 'string' | 'number' | 'boolean';
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  references?: string; 
}

interface TableDef {
  columns: Record<string, ColumnDef>;
  seed?: Record<string, unknown>[];
}

type SchemaJson = Record<string, TableDef>;

export async function runMigration(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'schema.json');

  if (!fs.existsSync(schemaPath)) {
    console.log(' Không tìm thấy file schema.json — bỏ qua migration');
    return;
  }

  const raw = fs.readFileSync(schemaPath, 'utf-8');
  const schema: SchemaJson = JSON.parse(raw);

  const sortedTables = topologicalSort(schema);

  for (const tableName of sortedTables) {
    const tableDef = schema[tableName];
    await createTableIfNotExists(tableName, tableDef);
  }

  await createAuditLogsTable();

  for (const tableName of sortedTables) {
    const tableDef = schema[tableName];
    if (tableDef.seed && tableDef.seed.length > 0) {
      await seedData(tableName, tableDef.seed);
    }
  }

  console.log(' Migration hoàn tất!');
}


function topologicalSort(schema: SchemaJson): string[] {
  const tables = Object.keys(schema);
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(table: string) {
    if (visited.has(table)) return;
    visited.add(table);

    const tableDef = schema[table];
    if (tableDef) {
      for (const colDef of Object.values(tableDef.columns)) {
        if (colDef.references && schema[colDef.references]) {
          visit(colDef.references);
        }
      }
    }

    result.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return result;
}


async function createTableIfNotExists(
  tableName: string,
  tableDef: TableDef
): Promise<void> {
  const exists = await db.schema.hasTable(tableName);

  if (exists) {
    console.log(` Bảng "${tableName}" đã tồn tại — bỏ qua`);
    return;
  }

  await db.schema.createTable(tableName, (table) => {
    // Cột id auto-increment
    table.increments('id').primary();

    // Tạo các cột từ schema definition
    for (const [colName, colDef] of Object.entries(tableDef.columns)) {
      let column;

      // Foreign key column
      if (colDef.references) {
        column = table
          .integer(colName)
          .unsigned()
          .references('id')
          .inTable(colDef.references)
          .onDelete('CASCADE');
      } else {
        // Map type → PostgreSQL column
        switch (colDef.type) {
          case 'number':
            column = table.integer(colName);
            break;
          case 'boolean':
            column = table.boolean(colName);
            break;
          case 'string':
          default:
            column = table.text(colName);
            break;
        }
      }

      // Áp dụng options
      if (colDef.nullable) {
        column.nullable();
      } else if (!colDef.references) {
        column.notNullable();
      }

      if (colDef.unique) {
        column.unique();
      }

      if (colDef.default !== undefined) {
        column.defaultTo(colDef.default as string | number | boolean);
      }
    }

    // Timestamps tự động
    table.timestamp('created_at').defaultTo(db.fn.now());
    table.timestamp('updated_at').defaultTo(db.fn.now());
  });

  console.log(` Đã tạo bảng "${tableName}"`);
}


async function createAuditLogsTable(): Promise<void> {
  const exists = await db.schema.hasTable('audit_logs');
  if (exists) {
    console.log('  Bảng "audit_logs" đã tồn tại — bỏ qua');
    return;
  }

  await db.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable();
    table.string('action').notNullable(); // CREATE, UPDATE, DELETE
    table.string('resource').notNullable(); // Tên bảng
    table.integer('record_id').unsigned().nullable(); // ID record
    table.jsonb('changes').nullable(); // Dữ liệu thay đổi (optional)
    table.timestamp('timestamp').defaultTo(db.fn.now());
  });

  console.log(' Đã tạo bảng "audit_logs"');
}


async function seedData(
  tableName: string,
  records: Record<string, unknown>[]
): Promise<void> {
  const count = await db(tableName).count('* as total').first();
  if (Number(count?.total || 0) > 0) {
    console.log(` Bảng "${tableName}" đã có dữ liệu — bỏ qua seed`);
    return;
  }

  const dataToInsert = await Promise.all(
    records.map(async (record) => {
      const { id, ...rest } = record as Record<string, unknown> & {
        id?: unknown;
      };

      if (tableName === 'users' && typeof rest.password === 'string') {
        rest.password = await bcrypt.hash(rest.password, 10);
      }

      return rest;
    })
  );

  await db(tableName).insert(dataToInsert);
  console.log(
    `Đã seed ${dataToInsert.length} records vào bảng "${tableName}"`
  );
}
