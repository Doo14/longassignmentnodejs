const { Client } = require('pg');

async function checkPort(port) {
  const client = new Client({
    host: 'localhost',
    port: port,
    database: 'pg_json_server',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(`Port ${port} tables:`, res.rows.map(r => r.table_name).join(', '));
    await client.end();
  } catch(err) {
    console.log(`Port ${port} failed:`, err.message);
  }
}

async function main() {
  await checkPort(5432);
  await checkPort(5433);
}

main();
