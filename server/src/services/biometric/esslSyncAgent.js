/**
 * eSSL eTimetracklite Local Sync Agent
 * ======================================
 * Runs on the OFFICE PC (same LAN as the eSSL biometric device/server).
 * Polls the eSSL SOAP API for new punch logs and pushes them to the
 * cloud HR app's /api/biometric/sync endpoint.
 *
 * Usage (on office PC):
 *   node esslSyncAgent.js
 *
 * Environment variables (create a .env file next to this script):
 *   ESSL_URL=http://192.168.2.222:85
 *   ESSL_API_PATH=/IClock/WebService.asmx        (or whatever path is found)
 *   ESSL_USER=dany
 *   ESSL_PASSWORD=Essl@123
 *   ESSL_API_KEY=11
 *   ESSL_COMPANY_CODE=essl
 *   ESSL_SERIAL=CUB7240300491
 *   HR_API_URL=https://eod.colorpapers.in
 *   HR_AGENT_KEY=biometric-sync-key
 *   POLL_INTERVAL_MINUTES=5
 *   LOOKBACK_DAYS=1
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
  esslUrl:       process.env.ESSL_URL         || 'http://192.168.2.222:85',
  esslApiPath:   process.env.ESSL_API_PATH    || '/IClock/WebService.asmx',
  esslUser:      process.env.ESSL_USER        || 'dany',
  esslPassword:  process.env.ESSL_PASSWORD    || 'Essl@123',
  esslApiKey:    process.env.ESSL_API_KEY     || '11',
  companyCode:   process.env.ESSL_COMPANY_CODE || 'essl',
  deviceSerial:  process.env.ESSL_SERIAL      || '',
  hrApiUrl:      process.env.HR_API_URL       || 'https://eod.colorpapers.in',
  hrAgentKey:    process.env.HR_AGENT_KEY     || 'biometric-sync-key',
  pollMinutes:   parseInt(process.env.POLL_INTERVAL_MINUTES || '5'),
  lookbackDays:  parseInt(process.env.LOOKBACK_DAYS || '1'),
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function formatDateEssl(d) {
  // eSSL API expects MM/DD/YYYY
  const [y, m, day] = d.toISOString().slice(0, 10).split('-');
  return `${m}/${day}/${y}`;
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
    if (body) req.write(body);
    req.end();
  });
}

// ─── Build SOAP envelope for GetTransactionsLog ───────────────────────────────
function buildSoapRequest(fromDate, toDate) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <UserName>${CONFIG.esslUser}</UserName>
      <UserPassword>${CONFIG.esslPassword}</UserPassword>
      <APIKey>${CONFIG.esslApiKey}</APIKey>
      <CompanyCode>${CONFIG.companyCode}</CompanyCode>
      <CompanySName>${CONFIG.companyCode}</CompanySName>
      <SerialNumber>${CONFIG.deviceSerial}</SerialNumber>
      <FromDate>${formatDateEssl(fromDate)}</FromDate>
      <ToDate>${formatDateEssl(toDate)}</ToDate>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;
}

// ─── Parse SOAP XML response ──────────────────────────────────────────────────
function parseSoapResponse(xml) {
  // Extract table rows from DataSet XML returned by eSSL
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

    // Combine date+time into "YYYY-MM-DD HH:MM:SS"
    let punchTime = logDate;
    if (logTime) punchTime = `${logDate} ${logTime}`;
    // Normalize date from MM/DD/YYYY to YYYY-MM-DD if needed
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

// ─── Push punches to cloud HR app ─────────────────────────────────────────────
async function pushToHrApp(punches) {
  if (!punches.length) return { inserted: 0 };

  const payload = JSON.stringify({
    agentKey:     CONFIG.hrAgentKey,
    deviceSerial: CONFIG.deviceSerial,
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
    throw new Error(`HR API returned ${res.status}: ${res.body}`);
  }
  return JSON.parse(res.body);
}

// ─── Fetch punches from eSSL SOAP API ────────────────────────────────────────
async function fetchFromEssl(fromDate, toDate) {
  const soapBody = buildSoapRequest(fromDate, toDate);
  const endpoint = `${CONFIG.esslUrl}${CONFIG.esslApiPath}`;

  console.log(`  Fetching from eSSL: ${formatDate(fromDate)} → ${formatDate(toDate)}`);
  console.log(`  Endpoint: ${endpoint}`);

  const res = await httpRequest(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':   'text/xml; charset=utf-8',
      'SOAPAction':     '"http://tempuri.org/GetTransactionsLog"',
      'Content-Length': Buffer.byteLength(soapBody),
    },
  }, soapBody);

  console.log(`  eSSL response status: ${res.status}`);

  if (res.status >= 400) {
    throw new Error(`eSSL API error ${res.status}: ${res.body.slice(0, 200)}`);
  }

  return parseSoapResponse(res.body);
}

// ─── Single sync cycle ────────────────────────────────────────────────────────
async function runSync() {
  const now      = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - CONFIG.lookbackDays);
  fromDate.setHours(0, 0, 0, 0);

  console.log(`\n[${now.toISOString()}] Starting sync...`);
  console.log(`  Device serial: ${CONFIG.deviceSerial || '(not set)'}`);
  console.log(`  HR App: ${CONFIG.hrApiUrl}`);

  try {
    const punches = await fetchFromEssl(fromDate, now);
    console.log(`  Fetched ${punches.length} punch records from eSSL`);

    if (punches.length > 0) {
      const result = await pushToHrApp(punches);
      console.log(`  Pushed to HR app: ${JSON.stringify(result)}`);
    } else {
      console.log('  No new punches to push');
    }
  } catch (err) {
    console.error(`  Sync error: ${err.message}`);
  }
}

// ─── Start agent ──────────────────────────────────────────────────────────────
async function main() {
  console.log('=== eSSL Biometric Sync Agent ===');
  console.log(`Poll interval: every ${CONFIG.pollMinutes} minutes`);
  console.log(`eSSL server: ${CONFIG.esslUrl}${CONFIG.esslApiPath}`);
  console.log(`HR app: ${CONFIG.hrApiUrl}`);

  if (!CONFIG.deviceSerial) {
    console.warn('WARNING: ESSL_SERIAL not set — sync will fail at the device lookup step');
  }

  // Run immediately on start, then on schedule
  await runSync();
  setInterval(runSync, CONFIG.pollMinutes * 60 * 1000);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
