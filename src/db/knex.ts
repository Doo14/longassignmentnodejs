import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();


export const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pg_json_server',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});
