// Run on CPSERVER: node check-devices.js
// This checks what DeviceId values exist in the eSSL SQL database

const sql = require('mssql');

const SQL_CONFIG = {
  server: 'CPSERVER',
  database: 'etimetracklite1',
  user: 'essl',
  password: 'essl',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  port: 1433,
};

(async () => {
  try {
    const pool = await sql.connect(SQL_CONFIG);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const tableName = `DeviceLogs_${month}_${year}`;

    // 1. Check available columns in the table
    console.log(`\n=== Columns in ${tableName} ===`);
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
      ORDER BY ORDINAL_POSITION
    `);
    cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

    // 2. Check unique DeviceId values and punch counts
    console.log(`\n=== Device IDs in ${tableName} ===`);
    const devices = await pool.request().query(`
      SELECT
        DeviceId,
        COUNT(*) AS punchCount,
        MIN(LogDate) AS firstPunch,
        MAX(LogDate) AS lastPunch
      FROM dbo.${tableName}
      GROUP BY DeviceId
      ORDER BY DeviceId
    `);
    devices.recordset.forEach(d => {
      console.log(`  DeviceId: ${d.DeviceId} — ${d.punchCount} punches (${d.firstPunch} to ${d.lastPunch})`);
    });

    // 3. Check if there's a device master table
    console.log('\n=== Looking for device master tables ===');
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME LIKE '%Device%' OR TABLE_NAME LIKE '%device%' OR TABLE_NAME LIKE '%Machine%'
      ORDER BY TABLE_NAME
    `);
    tables.recordset.forEach(t => console.log(`  ${t.TABLE_NAME}`));

    // 4. Sample punches per device (last 5 from each)
    console.log(`\n=== Sample punches per DeviceId ===`);
    const samples = await pool.request().query(`
      SELECT DeviceId, CAST(UserId AS VARCHAR) AS UserId, LogDate, Direction
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY DeviceId ORDER BY LogDate DESC) AS rn
        FROM dbo.${tableName}
      ) sub
      WHERE rn <= 3
      ORDER BY DeviceId, LogDate DESC
    `);
    samples.recordset.forEach(s => {
      console.log(`  Device ${s.DeviceId}: User ${s.UserId}, ${s.LogDate}, Dir: ${s.Direction || '-'}`);
    });

    await pool.close();
    console.log('\nDone! Use the DeviceId values above to create the mapping.');
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
