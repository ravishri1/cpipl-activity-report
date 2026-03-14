/**
 * Biometric Sync Service
 * ======================
 * Server-side biometric data fetching from eSSL devices.
 * Runs as a cron job — no need for a separate local agent.
 *
 * Uses device credentials stored in BiometricDevice DB model
 * to fetch punch data via SOAP API from eSSL eTimetracklite.
 *
 * Note: Only works when the server can reach the eSSL device
 * (local dev server on same LAN, or device exposed via VPN/public IP).
 * On Vercel (can't reach LAN), sync fails gracefully per device.
 */

const https = require('https');
const http  = require('http');

// ─── HTTP helper ─────────────────────────────────────────────────────────────
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

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDateISO(d) {
  return d.toISOString().slice(0, 10);
}
function formatDateEssl(d) {
  const [y, m, day] = d.toISOString().slice(0, 10).split('-');
  return `${m}/${day}/${y}`;
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

// ─── Match enroll number to employee ──────────────────────────────────────────
async function matchEmployee(enrollNumber, prisma) {
  return prisma.user.findFirst({
    where: { bioDeviceId: enrollNumber, isActive: true },
    select: { id: true, name: true, employeeId: true },
  });
}

// ─── Process a raw punch into attendance ──────────────────────────────────────
async function processPunch(punch, prisma) {
  if (punch.processStatus === 'processed' || punch.processStatus === 'skipped') return;
  if (!punch.userId) {
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { processStatus: 'skipped', processNote: 'No matched employee' },
    });
    return;
  }

  const punchDate  = punch.punchDate;
  const punchTime  = punch.punchTime;
  const timeStr    = punchTime.slice(11, 16);
  const direction  = punch.direction;
  const punchDateTime = new Date(punchTime.replace(' ', 'T') + '+05:30');

  let attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: punch.userId, date: punchDate } },
  });

  if (!attendance) {
    if (direction === 'out') {
      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { processStatus: 'skipped', processNote: 'Exit punch but no clock-in found for this date' },
      });
      return;
    }
    attendance = await prisma.attendance.create({
      data: {
        userId:  punch.userId,
        date:    punchDate,
        checkIn: punchDateTime,
        status:  'present',
        notes:   `Biometric clock-in ${timeStr} via ${punch.deviceSerial}`,
      },
    });
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: attendance.id, processStatus: 'processed', processNote: `Clock-in created (${timeStr})` },
    });
  } else if (direction === 'in') {
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: attendance.id, processStatus: 'skipped', processNote: 'Duplicate entry punch (already clocked in)' },
    });
  } else if (
    !attendance.checkOut &&
    attendance.checkIn &&
    (direction === 'out' || (!direction && punchDateTime > attendance.checkIn))
  ) {
    const workHours = (punchDateTime.getTime() - attendance.checkIn.getTime()) / 3600000;
    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut:  punchDateTime,
        workHours: Math.round(workHours * 100) / 100,
        notes: attendance.notes
          ? attendance.notes + ` | Biometric clock-out ${timeStr}`
          : `Biometric clock-out ${timeStr}`,
      },
    });
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: attendance.id, processStatus: 'processed', processNote: `Clock-out updated (${timeStr})` },
    });
  } else {
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: attendance?.id, processStatus: 'skipped', processNote: 'Duplicate or out-of-order punch' },
    });
  }
}

// ─── Fetch punches from one eSSL device via SOAP ─────────────────────────────
async function fetchFromDevice(device, lookbackDays = 1) {
  if (!device.esslUrl) throw new Error(`Device ${device.name}: no esslUrl configured`);
  if (!device.apiUser || !device.apiPassword) throw new Error(`Device ${device.name}: missing API credentials`);

  const now      = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - lookbackDays);
  fromDate.setHours(0, 0, 0, 0);

  const apiPath  = '/IClock/WebService.asmx';
  const endpoint = device.esslUrl.replace(/\/$/, '') + apiPath;
  const soapBody = buildSoapRequest(device, fromDate, now);

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

// ─── Process and store punches for a device ──────────────────────────────────
async function processAndStorePunches(prisma, device, rawPunches) {
  let inserted = 0, matched = 0, processed = 0;

  for (const p of rawPunches) {
    const punchDate = p.punchTime ? p.punchTime.slice(0, 10) : null;
    if (!p.enrollNumber || !p.punchTime || !punchDate) continue;

    const employee = await matchEmployee(p.enrollNumber, prisma);
    const effectiveDirection = device.forceDirection || p.direction || null;

    let punch;
    try {
      punch = await prisma.biometricPunch.create({
        data: {
          deviceId:     device.id,
          deviceSerial: device.serialNumber,
          enrollNumber: p.enrollNumber,
          punchTime:    p.punchTime,
          punchDate:    punchDate,
          direction:    effectiveDirection,
          workCode:     p.workCode  || null,
          rawData:      null,
          userId:       employee ? employee.id : null,
          matchStatus:  employee ? 'matched' : 'unmatched',
          matchNote:    employee ? null : `No employee with bioDeviceId=${p.enrollNumber}`,
        },
      });
      inserted++;
      if (employee) matched++;
    } catch (e) {
      if (e.code === 'P2002') continue; // Duplicate punch — skip
      throw e;
    }

    if (punch && employee) {
      await processPunch(punch, prisma);
      processed++;
    }
  }

  return { inserted, matched, processed };
}

// ─── Sync one device: fetch + process + update status ────────────────────────
async function syncDevice(prisma, device) {
  const startTime = Date.now();
  try {
    const rawPunches = await fetchFromDevice(device, 1);
    const result = await processAndStorePunches(prisma, device, rawPunches);

    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSyncAt:      new Date(),
        lastSyncStatus:  'success',
        lastSyncMessage: `${rawPunches.length} fetched, ${result.inserted} new, ${result.matched} matched, ${result.processed} processed (${Date.now() - startTime}ms)`,
      },
    });

    return { device: device.name, status: 'success', ...result, fetched: rawPunches.length };
  } catch (err) {
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSyncAt:      new Date(),
        lastSyncStatus:  'failed',
        lastSyncMessage: err.message.slice(0, 500),
      },
    });
    return { device: device.name, status: 'failed', error: err.message };
  }
}

// ─── Sync all active devices (respects per-device interval) ──────────────────
async function syncAllDevices(prisma) {
  const devices = await prisma.biometricDevice.findMany({
    where: { isActive: true },
  });

  if (!devices.length) return { synced: 0, skipped: 0, failed: 0, details: [] };

  let synced = 0, skipped = 0, failed = 0;
  const details = [];

  for (const device of devices) {
    // Skip if device was synced too recently (respect per-device syncIntervalMin)
    if (device.lastSyncAt) {
      const minutesSinceSync = (Date.now() - device.lastSyncAt.getTime()) / 60000;
      if (minutesSinceSync < (device.syncIntervalMin || 5)) {
        skipped++;
        details.push({ device: device.name, status: 'skipped', reason: `Last synced ${Math.round(minutesSinceSync)}m ago (interval: ${device.syncIntervalMin || 5}m)` });
        continue;
      }
    }

    // Skip if no eSSL URL configured
    if (!device.esslUrl) {
      skipped++;
      details.push({ device: device.name, status: 'skipped', reason: 'No esslUrl configured' });
      continue;
    }

    const result = await syncDevice(prisma, device);
    if (result.status === 'success') synced++;
    else failed++;
    details.push(result);
  }

  return { synced, skipped, failed, total: devices.length, details };
}

module.exports = {
  matchEmployee,
  processPunch,
  processAndStorePunches,
  fetchFromDevice,
  syncDevice,
  syncAllDevices,
};
