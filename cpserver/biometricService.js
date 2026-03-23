/**
 * Biometric Service for cpserver
 * Combines: Express API + Cloudflare Tunnel + Auto-registration
 *
 * Runs on port 3001, starts cloudflared tunnel, and registers
 * the tunnel URL with the HR app so Vercel can query cpserver SQL directly.
 *
 * Install: copy to C:\esslSync\biometricService.js on cpserver
 * Run: node biometricService.js
 */

const express = require('express');
const sql = require('mssql');
const { spawn } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = 3001;
const HR_API_URL = 'https://eod.colorpapers.in';
const AGENT_KEY = 'cpipl-bio-sync-2026-xK9mP4qR7v2';
const CLOUDFLARED_PATH = path.join(__dirname, 'cloudflared.exe');
const LOG_FILE = path.join(__dirname, 'biometric-service.log');

const SQL_CONFIG = {
  server: 'CPSERVER',
  database: 'etimetracklite1',
  user: 'essl',
  password: 'essl',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  port: 1433,
};

const DEVICE_MAP = {
  19: 'CEXJ230260263',   // CP IN (Mumbai)
  20: 'CEXJ230260034',   // CP OUT (Mumbai)
  21: 'EUF7241301750',   // Lucknow
};

// ── Logging ─────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

// ── Express API ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Auth middleware for /api routes
app.use('/api', (req, res, next) => {
  const key = req.headers['x-agent-key'] || req.query.key;
  if (key !== AGENT_KEY) return res.status(401).json({ error: 'Invalid key' });
  next();
});

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), tunnelUrl: currentTunnelUrl || 'pending' });
});

// GET /api/punches?date=2026-03-23
app.get('/api/punches', async (req, res) => {
  try {
    const { date, month, year } = req.query;
    const d = date ? new Date(date) : new Date();
    const m = month || d.getMonth() + 1;
    const y = year || d.getFullYear();
    const table = `DeviceLogs_${m}_${y}`;

    const pool = await sql.connect(SQL_CONFIG);
    let query = `SELECT DeviceId, CAST(UserId AS VARCHAR) AS enrollNumber, LogDate AS punchTime, Direction FROM dbo.${table}`;
    if (date) query += ` WHERE CAST(LogDate AS DATE) = '${date}'`;
    query += ' ORDER BY LogDate ASC';

    const result = await pool.request().query(query);
    await pool.close();

    const punches = result.recordset.map(row => ({
      deviceSn: DEVICE_MAP[row.DeviceId] || `UNKNOWN_${row.DeviceId}`,
      enrollNumber: String(row.enrollNumber),
      punchTime: formatDateTime(row.punchTime),
      direction: row.Direction ? row.Direction.trim().toLowerCase() : null,
    }));

    res.json({ punches, count: punches.length });
  } catch (err) {
    log(`ERROR /api/punches: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/punches/range?start=2026-03-01&end=2026-03-23
app.get('/api/punches/range', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });

    const pool = await sql.connect(SQL_CONFIG);
    const startDate = new Date(start);
    const endDate = new Date(end);
    let allPunches = [];

    let current = new Date(startDate);
    while (current <= endDate) {
      const m = current.getMonth() + 1;
      const y = current.getFullYear();
      const table = `DeviceLogs_${m}_${y}`;
      try {
        const result = await pool.request().query(
          `SELECT DeviceId, CAST(UserId AS VARCHAR) AS enrollNumber, LogDate AS punchTime, Direction
           FROM dbo.${table} WHERE LogDate >= '${start}' AND LogDate <= '${end} 23:59:59' ORDER BY LogDate ASC`
        );
        result.recordset.forEach(row => allPunches.push({
          deviceSn: DEVICE_MAP[row.DeviceId] || `UNKNOWN_${row.DeviceId}`,
          enrollNumber: String(row.enrollNumber),
          punchTime: formatDateTime(row.punchTime),
          direction: row.Direction ? row.Direction.trim().toLowerCase() : null,
        }));
      } catch (e) { /* table might not exist for this month */ }
      current.setMonth(current.getMonth() + 1);
    }
    await pool.close();
    res.json({ punches: allPunches, count: allPunches.length });
  } catch (err) {
    log(`ERROR /api/punches/range: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — total records per month
app.get('/api/stats', async (req, res) => {
  try {
    const pool = await sql.connect(SQL_CONFIG);
    const result = await pool.request().query(`
      SELECT TABLE_NAME, SUM(p.rows) AS row_count
      FROM sys.tables t JOIN sys.partitions p ON t.object_id = p.object_id
      WHERE t.name LIKE 'DeviceLogs_%' AND p.index_id IN (0,1)
      GROUP BY TABLE_NAME ORDER BY TABLE_NAME
    `);
    await pool.close();
    const tables = result.recordset.map(r => ({ table: r.TABLE_NAME, rows: r.row_count }));
    const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
    res.json({ tables, totalRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatDateTime(dt) {
  const d = new Date(dt);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ── Tunnel Management ───────────────────────────────────────────────────────
let currentTunnelUrl = null;
let tunnelProcess = null;

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED_PATH)) {
    log('WARNING: cloudflared.exe not found. Tunnel not started. API is local-only.');
    return;
  }

  log('Starting cloudflared tunnel...');
  tunnelProcess = spawn(CLOUDFLARED_PATH, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let outputBuffer = '';

  tunnelProcess.stderr.on('data', (data) => {
    const text = data.toString();
    outputBuffer += text;

    // Parse tunnel URL from cloudflared output
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !currentTunnelUrl) {
      currentTunnelUrl = match[0];
      log(`Tunnel URL: ${currentTunnelUrl}`);
      registerTunnelUrl(currentTunnelUrl);
    }
  });

  tunnelProcess.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !currentTunnelUrl) {
      currentTunnelUrl = match[0];
      log(`Tunnel URL: ${currentTunnelUrl}`);
      registerTunnelUrl(currentTunnelUrl);
    }
  });

  tunnelProcess.on('exit', (code) => {
    log(`Tunnel process exited with code ${code}. Restarting in 10s...`);
    currentTunnelUrl = null;
    setTimeout(startTunnel, 10000);
  });

  tunnelProcess.on('error', (err) => {
    log(`Tunnel error: ${err.message}. Retrying in 10s...`);
    setTimeout(startTunnel, 10000);
  });
}

function registerTunnelUrl(url) {
  const body = JSON.stringify({ agentKey: AGENT_KEY, tunnelUrl: url });
  const reqUrl = new URL(`${HR_API_URL}/api/biometric/register-tunnel`);

  const options = {
    hostname: reqUrl.hostname,
    port: 443,
    path: reqUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-agent-key': AGENT_KEY,
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        log(`Tunnel URL registered with HR app: ${url}`);
      } else {
        log(`Failed to register tunnel URL: ${res.statusCode} ${data}`);
        // Retry after 30s
        setTimeout(() => registerTunnelUrl(url), 30000);
      }
    });
  });

  req.on('error', (err) => {
    log(`Failed to register tunnel URL: ${err.message}. Retrying in 30s...`);
    setTimeout(() => registerTunnelUrl(url), 30000);
  });

  req.write(body);
  req.end();
}

// ── Start Everything ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log(`═══════════════════════════════════════════════`);
  log(`  Biometric Service v1.0`);
  log(`  API running on port ${PORT}`);
  log(`  SQL Server: ${SQL_CONFIG.server}/${SQL_CONFIG.database}`);
  log(`  HR App: ${HR_API_URL}`);
  log(`═══════════════════════════════════════════════`);

  // Start tunnel after API is ready
  setTimeout(startTunnel, 2000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down...');
  if (tunnelProcess) tunnelProcess.kill();
  process.exit(0);
});
