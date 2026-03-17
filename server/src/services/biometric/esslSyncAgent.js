/**
 * eSSL eTimetracklite Multi-Device Local Sync Agent
 * ===================================================
 * Runs on the OFFICE PC (same LAN as the eSSL biometric devices).
 *
 * TWO MODES:
 * 1. Multi-device mode (recommended): Fetches device list from HR API, syncs all devices
 * 2. Single-device mode (legacy): Uses env vars for one device
 *
 * Usage (on office PC):
 *   node esslSyncAgent.js
 *
 * Environment variables (create a .env file next to this script):
 *   # Common settings
 *   HR_API_URL=https://eod.colorpapers.in
 *   HR_AGENT_KEY=biometric-sync-key
 *   POLL_INTERVAL_MINUTES=5
 *   LOOKBACK_DAYS=1
 *
 *   # Multi-device mode (recommended — devices are auto-discovered from HR API)
 *   MODE=multi
 *
 *   # Single-device mode (legacy — only syncs one device)
 *   MODE=single
 *   ESSL_URL=http://192.168.2.222:85
 *   ESSL_API_PATH=/IClock/WebService.asmx
 *   ESSL_USER=dany
 *   ESSL_PASSWORD=Essl@123
 *   ESSL_API_KEY=11
 *   ESSL_COMPANY_CODE=essl
 *   ESSL_SERIAL=CUB7240300491
 */

const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

// ─── Load env from .env file if present ──────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const CONFIG = {
  mode:          process.env.MODE              || 'multi',  // 'multi' or 'single'
  hrApiUrl:      process.env.HR_API_URL        || 'https://eod.colorpapers.in',
  hrAgentKey:    process.env.HR_AGENT_KEY      || 'biometric-sync-key',
  pollMinutes:   parseInt(process.env.POLL_INTERVAL_MINUTES || '5'),
  lookbackDays:  parseInt(process.env.LOOKBACK_DAYS || '1'),
  // Single-device mode settings (legacy)
  esslUrl:       process.env.ESSL_URL          || 'http://192.168.2.222:85',
  esslApiPath:   process.env.ESSL_API_PATH     || '/IClock/WebService.asmx',
  esslUser:      process.env.ESSL_USER         || 'dany',
  esslPassword:  process.env.ESSL_PASSWORD     || 'Essl@123',
  esslApiKey:    process.env.ESSL_API_KEY      || '11',
  companyCode:   process.env.ESSL_COMPANY_CODE || 'essl',
  deviceSerial:  process.env.ESSL_SERIAL       || '',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function formatDateEssl(d) {
  const [y, m, day] = d.toISOString().slice(0, 10).split('-');
  return `${m}/${day}/${y}`;
}
function timestamp() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req    = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      ...options,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Request timeout (30s)')); });
    if (body) req.write(body);
    req.end();
  });
}

// ─── Build SOAP envelope for GetTransactionsLog ───────────────────────────────
function buildSoapRequest(device, fromDate, toDate) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <UserName>${device.apiUser}</UserName>
      <UserPassword>${device.apiPassword}</UserPassword>
      <APIKey>${device.apiKey}</APIKey>
      <CompanyCode>${device.companyCode}</CompanyCode>
      <CompanySName>${device.companyCode}</CompanySName>
      <SerialNumber>${device.serialNumber}</SerialNumber>
      <FromDate>${formatDateEssl(fromDate)}</FromDate>
      <ToDate>${formatDateEssl(toDate)}</ToDate>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;
}

// ─── Parse SOAP XML response ──────────────────────────────────────────────────
function parseSoapResponse(xml) {
  const punches = [];
  const rowRegex = /<Table>([\s\S]*?)<\/Table>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const get = (tag) => {
      const m = new RegExp(`<${tag}>(.*?)</${tag}>`).exec(rowXml);
      return m ? m[1].trim() : null;
    };

    const empCode   = get('EMPLOYEECODE') || get('EmployeeCode') || get('EmpCode') || get('UserID');
    const logDate   = get('LOGDATE')       || get('LogDate')      || get('Date');
    const logTime   = get('LOGTIME')       || get('LogTime')      || get('Time');
    const direction = get('DIRECTION')     || get('InOut')        || get('PunchDirection');
    const workCode  = get('WORKCODE')      || get('WorkCode');

    if (!empCode || !logDate) continue;

    let punchTime = logDate;
    if (logTime) punchTime = `${logDate} ${logTime}`;
    const dateParts = logDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dateParts) {
      punchTime = `${dateParts[3]}-${dateParts[1].padStart(2,'0')}-${dateParts[2].padStart(2,'0')}${logTime ? ' '+logTime : ''}`;
    }

    let dir = null;
    if (direction === '0' || direction?.toLowerCase() === 'in')  dir = 'in';
    if (direction === '1' || direction?.toLowerCase() === 'out') dir = 'out';

    punches.push({
      enrollNumber: empCode,
      punchTime:    punchTime.trim(),
      direction:    dir,
      workCode:     workCode || null,
    });
  }

  return punches;
}

// ─── Push punches to cloud HR app (single device) ───────────────────────────
async function pushToHrApp(deviceSerial, punches) {
  const payload = JSON.stringify({
    agentKey:     CONFIG.hrAgentKey,
    deviceSerial: deviceSerial,
    punches,
  });

  const hrUrl = new URL('/api/biometric/sync', CONFIG.hrApiUrl);
  const res   = await httpRequest(hrUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  if (res.status !== 200) {
    throw new Error(`HR API returned ${res.status}: ${res.body.slice(0, 300)}`);
  }
  return JSON.parse(res.body);
}

// ─── Push ALL devices data in one call (batch) ──────────────────────────────
async function pushBatchToHrApp(allDeviceData) {
  const payload = JSON.stringify({
    agentKey: CONFIG.hrAgentKey,
    devices: allDeviceData,
  });

  const hrUrl = new URL('/api/biometric/agent-sync', CONFIG.hrApiUrl);
  const res   = await httpRequest(hrUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);

  if (res.status !== 200) {
    throw new Error(`HR API returned ${res.status}: ${res.body.slice(0, 300)}`);
  }
  return JSON.parse(res.body);
}

// ─── Fetch device list from HR API ───────────────────────────────────────────
async function fetchDeviceList() {
  const url = new URL('/api/biometric/devices', CONFIG.hrApiUrl);
  // Use agent key header for auth (device list is normally admin-only,
  // but we'll use a special header for the agent)
  const res = await httpRequest(url.toString(), {
    method: 'GET',
    headers: { 'x-agent-key': CONFIG.hrAgentKey },
  });

  if (res.status !== 200) {
    throw new Error(`Failed to fetch device list: ${res.status}`);
  }
  return JSON.parse(res.body);
}

// ─── Fetch punches from eSSL SOAP API ────────────────────────────────────────
async function fetchFromEssl(device, fromDate, toDate) {
  const apiPath  = '/IClock/WebService.asmx';
  const endpoint = device.esslUrl.replace(/\/$/, '') + apiPath;

  const soapBody = buildSoapRequest(device, fromDate, toDate);

  const res = await httpRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':   'text/xml; charset=utf-8',
      'SOAPAction':     '"http://tempuri.org/GetTransactionsLog"',
      'Content-Length': Buffer.byteLength(soapBody),
    },
  }, soapBody);

  if (res.status >= 400) {
    throw new Error(`eSSL API error ${res.status}: ${res.body.slice(0, 200)}`);
  }

  return parseSoapResponse(res.body);
}

// ─── Sync one device ────────────────────────────────────────────────────────
async function syncOneDevice(device, fromDate, toDate) {
  const label = `${device.name} (${device.serialNumber})`;

  if (!device.esslUrl) {
    console.log(`  ⏭️  ${label}: No eSSL URL configured — skipping`);
    return { device: device.name, status: 'skipped', reason: 'No esslUrl' };
  }
  if (!device.apiUser || !device.apiPassword) {
    console.log(`  ⏭️  ${label}: Missing API credentials — skipping`);
    return { device: device.name, status: 'skipped', reason: 'Missing credentials' };
  }

  try {
    console.log(`  🔄 ${label}: Fetching from ${device.esslUrl}...`);
    const punches = await fetchFromEssl(device, fromDate, toDate);
    console.log(`     Fetched ${punches.length} punch records`);

    if (punches.length > 0) {
      const result = await pushToHrApp(device.serialNumber, punches);
      console.log(`     ✅ Pushed: ${result.inserted || 0} new, ${result.matched || 0} matched, ${result.processed || 0} processed`);
      return { device: device.name, status: 'success', fetched: punches.length, ...result };
    } else {
      console.log(`     ℹ️  No punches in date range`);
      // Still push empty to update last sync timestamp
      await pushToHrApp(device.serialNumber, []);
      return { device: device.name, status: 'success', fetched: 0 };
    }
  } catch (err) {
    console.log(`     ❌ Error: ${err.message}`);
    return { device: device.name, status: 'failed', error: err.message };
  }
}

// ─── Multi-device sync cycle ────────────────────────────────────────────────
async function runMultiSync() {
  const now      = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - CONFIG.lookbackDays);
  fromDate.setHours(0, 0, 0, 0);

  console.log(`\n[${timestamp()}] Starting multi-device sync...`);
  console.log(`  Date range: ${formatDate(fromDate)} → ${formatDate(now)}`);
  console.log(`  HR App: ${CONFIG.hrApiUrl}`);

  let devices;
  try {
    devices = await fetchDeviceList();
    const active = devices.filter(d => d.isActive);
    console.log(`  Found ${devices.length} devices (${active.length} active)`);
    devices = active;
  } catch (err) {
    console.error(`  ❌ Could not fetch device list: ${err.message}`);
    console.log(`  💡 Make sure HR_API_URL and HR_AGENT_KEY are correct`);
    return;
  }

  if (devices.length === 0) {
    console.log('  No active devices to sync');
    return;
  }

  // Fetch from ALL devices locally, then push everything to cloud in one batch
  const allDeviceData = [];
  let synced = 0, failed = 0, skipped = 0;

  for (const device of devices) {
    const label = `${device.name} (${device.serialNumber})`;

    if (!device.esslUrl) {
      console.log(`  ⏭️  ${label}: No eSSL URL — skipping`);
      skipped++;
      continue;
    }
    if (!device.apiUser || !device.apiPassword) {
      console.log(`  ⏭️  ${label}: Missing API credentials — skipping`);
      skipped++;
      continue;
    }

    try {
      console.log(`  🔄 ${label}: Fetching from ${device.esslUrl}...`);
      const punches = await fetchFromEssl(device, fromDate, now);
      console.log(`     ✅ Fetched ${punches.length} punch records`);
      allDeviceData.push({ deviceSerial: device.serialNumber, punches });
      synced++;
    } catch (err) {
      console.log(`     ❌ Error: ${err.message}`);
      // Still push empty data so cloud knows we attempted
      allDeviceData.push({ deviceSerial: device.serialNumber, punches: [] });
      failed++;
    }
  }

  // Push all data to cloud in one batch call
  if (allDeviceData.length > 0) {
    try {
      console.log(`\n  📤 Pushing data for ${allDeviceData.length} devices to cloud...`);
      const totalPunches = allDeviceData.reduce((sum, d) => sum + d.punches.length, 0);
      console.log(`     Total punches to push: ${totalPunches}`);
      const result = await pushBatchToHrApp(allDeviceData);
      console.log(`     ✅ Cloud response:`, JSON.stringify(result.results?.map(r => `${r.device}: ${r.status} (${r.inserted || 0} new, ${r.matched || 0} matched)`)));
    } catch (err) {
      console.error(`     ❌ Batch push failed: ${err.message}`);
      // Fallback: push individually
      console.log('     🔄 Falling back to individual device push...');
      for (const dd of allDeviceData) {
        if (dd.punches.length === 0) continue;
        try {
          const result = await pushToHrApp(dd.deviceSerial, dd.punches);
          console.log(`     ${dd.deviceSerial}: ${result.inserted || 0} new, ${result.matched || 0} matched`);
        } catch (e) {
          console.error(`     ${dd.deviceSerial}: Push failed — ${e.message}`);
        }
      }
    }
  }

  console.log(`\n  Summary: ${synced} fetched, ${failed} failed, ${skipped} skipped`);
}

// ─── Single-device sync cycle (legacy) ─────────────────────────────────────
async function runSingleSync() {
  const now      = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - CONFIG.lookbackDays);
  fromDate.setHours(0, 0, 0, 0);

  console.log(`\n[${timestamp()}] Starting single-device sync...`);
  console.log(`  Device serial: ${CONFIG.deviceSerial || '(not set)'}`);
  console.log(`  HR App: ${CONFIG.hrApiUrl}`);

  const device = {
    name: 'Local Device',
    serialNumber: CONFIG.deviceSerial,
    esslUrl: CONFIG.esslUrl,
    apiUser: CONFIG.esslUser,
    apiPassword: CONFIG.esslPassword,
    apiKey: CONFIG.esslApiKey,
    companyCode: CONFIG.companyCode,
  };

  await syncOneDevice(device, fromDate, now);
}

// ─── Start agent ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  eSSL Biometric Sync Agent v2.0       ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Mode: ${CONFIG.mode === 'multi' ? 'Multi-device (auto-discover)' : 'Single-device (legacy)'}`);
  console.log(`Poll interval: every ${CONFIG.pollMinutes} minutes`);
  console.log(`Lookback: ${CONFIG.lookbackDays} day(s)`);
  console.log(`HR app: ${CONFIG.hrApiUrl}`);

  if (CONFIG.mode === 'single' && !CONFIG.deviceSerial) {
    console.warn('⚠️  WARNING: ESSL_SERIAL not set — single-device sync will fail');
  }

  const syncFn = CONFIG.mode === 'multi' ? runMultiSync : runSingleSync;

  // Run immediately on start, then on schedule
  await syncFn();
  setInterval(syncFn, CONFIG.pollMinutes * 60 * 1000);

  console.log(`\n⏰ Next sync in ${CONFIG.pollMinutes} minutes...`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
