// Run on CPSERVER: node check-device-names.js
// Reads the Devices master table to find device names and serial numbers

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

    // 1. Show Devices table columns
    console.log('\n=== Columns in Devices table ===');
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Devices'
      ORDER BY ORDINAL_POSITION
    `);
    cols.recordset.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE})`));

    // 2. Show all devices
    console.log('\n=== All Devices ===');
    const devices = await pool.request().query(`SELECT * FROM Devices`);
    devices.recordset.forEach(d => {
      console.log(`\n  --- Device ---`);
      Object.entries(d).forEach(([key, val]) => {
        if (val !== null && val !== '') {
          console.log(`    ${key}: ${val}`);
        }
      });
    });

    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
