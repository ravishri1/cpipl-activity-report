const { Pool } = require(require('path').join(__dirname, '../server/node_modules/pg'));

const pool = new Pool({
  host: '100.51.95.243', port: 5432, database: 'neondb',
  user: 'neondb_owner', password: 'npg_NqgGyPWMs24S',
  ssl: { rejectUnauthorized: false, servername: 'ep-spring-king-an1a86sd-pooler.c-6.us-east-1.aws.neon.tech' },
  connectionTimeoutMillis: 10000,
});

async function main() {
  const client = await pool.connect();
  // Set logo for all companies
  await client.query(`UPDATE "Company" SET "logoUrl" = '/cp-logo.png'`);
  console.log('✓ logoUrl set to /cp-logo.png for all companies');
  const res = await client.query(`SELECT id, name, "logoUrl" FROM "Company"`);
  res.rows.forEach(r => console.log(`  [${r.id}] ${r.name} → ${r.logoUrl}`));
  client.release();
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
