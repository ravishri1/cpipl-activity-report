const sql = require('mssql');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SQL_CONFIG = {
  server: 'CPSERVER',
  database: 'etimetracklite1',
  user: 'essl',
  password: 'essl',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  port: 1433,
};

const HR_API_URL    = 'https://eod.colorpapers.in';
const HR_AGENT_KEY  = 'cpipl-bio-sync-2026-xK9mP4qR7v2';
const LOOKBACK_DAYS = 1;
const LOG_FILE      = path.join(__dirname, 'sync-log.txt');

// ══════════════════════════════════════════════════════════════════════════════
// DEVICE MAPPING — eSSL DeviceId → registered device serial number
// Run "node check-devices.js" to find the DeviceId values in your SQL database
// Then map each DeviceId to the correct device serial registered in the HR portal
// ══════════════════════════════════════════════════════════════════════════════
const DEVICE_MAP = {
  19: 'CEXJ230260263',   // CP IN (Mumbai HO) — "color in", IP 192.168.2.201
  20: 'CEXJ230260034',   // CP OUT (Mumbai HO) — "Color", IP 192.168.2.205
  21: 'EUF7241301750',   // Lucknow — "Lucknow", IP 192.168.0.203
};

// Fallback serial if DeviceId is not in the map (old Lucknow SQL Sync device)
const DEFAULT_DEVICE_SERIAL = 'CUB7240300491';

function log(msg) {
  const line = `[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

async function fetchPunchesFromSQL() {
  const pool = await sql.connect(SQL_CONFIG);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const tableName = `DeviceLogs_${month}_${year}`;
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const result = await pool.request()
    .input('since', sql.DateTime, since)
    .query(`
      SELECT
        DeviceId,
        CAST(UserId AS VARCHAR) AS enrollNumber,
        LogDate                 AS punchTime,
        Direction               AS direction
      FROM dbo.${tableName}
      WHERE LogDate >= @since
      ORDER BY LogDate ASC
    `);

  await pool.close();

  return result.recordset.map(row => ({
    deviceId:     row.DeviceId,
    enrollNumber: String(row.enrollNumber),
    punchTime:    formatDateTime(row.punchTime),
    direction:    row.direction ? row.direction.trim().toLowerCase() : null,
  }));
}

function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function pushToHR(deviceSerial, punches) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      agentKey:     HR_AGENT_KEY,
      deviceSerial,
      punches: punches.map(p => ({
        enrollNumber: p.enrollNumber,
        punchTime:    p.punchTime,
        direction:    p.direction,
      })),
    });

    const url = new URL(`${HR_API_URL}/api/biometric/sync`);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-agent-key':    HR_AGENT_KEY,
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Run once and exit (Task Scheduler handles repeating) ──
(async () => {
  log('--- Sync started ---');
  try {
    const punches = await fetchPunchesFromSQL();
    log(`Fetched ${punches.length} punch records from SQL`);
    if (punches.length === 0) {
      log('No punches found. Done.');
      process.exit(0);
    }

    // Group punches by device serial
    const byDevice = {};
    for (const p of punches) {
      const serial = DEVICE_MAP[p.deviceId] || DEFAULT_DEVICE_SERIAL;
      if (!byDevice[serial]) byDevice[serial] = [];
      byDevice[serial].push(p);
    }

    // Push each device's punches separately
    const deviceSerials = Object.keys(byDevice);
    log(`Punches spread across ${deviceSerials.length} device(s): ${deviceSerials.join(', ')}`);

    for (const serial of deviceSerials) {
      const devicePunches = byDevice[serial];
      log(`Pushing ${devicePunches.length} punches for device ${serial}...`);
      const result = await pushToHR(serial, devicePunches);
      log(`  Result [${serial}]: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    log(`ERROR: ${err.message}`);
  }
  process.exit(0);
})();
