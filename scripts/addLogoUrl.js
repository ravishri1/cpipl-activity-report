const { Pool } = require(require('path').join(__dirname, '../server/node_modules/pg'));

const pool = new Pool({
  host: '100.51.95.243', port: 5432, database: 'neondb',
  user: 'neondb_owner', password: 'npg_NqgGyPWMs24S',
  ssl: { rejectUnauthorized: false, servername: 'ep-spring-king-an1a86sd-pooler.c-6.us-east-1.aws.neon.tech' },
  connectionTimeoutMillis: 10000,
});

async function main() {
  const client = await pool.connect();
  console.log('✓ Connected');
  await client.query('ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT');
  console.log('✓ logoUrl column added to Company table');
  client.release();
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
