const { Client } = require('pg');

const passwords = ['root', '123456', 'root 123456', 'postgres', 'password', ''];

async function test() {
  for (const pwd of passwords) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'pg_json_server',
      user: 'postgres',
      password: pwd,
    });
    try {
      await client.connect();
      console.log('SUCCESS with password:', pwd);
      await client.end();
      return;
    } catch(err) {
      console.log('Failed with', pwd, ':', err.message);
    }
  }
}
test();
