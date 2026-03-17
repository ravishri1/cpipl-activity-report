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
    // Update checkIn only if this punch is EARLIER than current checkIn (first in wins)
    if (attendance.checkIn && punchDateTime < attendance.checkIn) {
      const workHours = attendance.checkOut
        ? (attendance.checkOut.getTime() - punchDateTime.getTime()) / 3600000
        : null;
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          checkIn: punchDateTime,
          ...(workHours !== null && { workHours: Math.round(workHours * 100) / 100 }),
          notes: attendance.notes
            ? attendance.notes + ` | Earlier clock-in ${timeStr}`
            : `Biometric clock-in ${timeStr}`,
        },
      });
      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { attendanceId: attendance.id, processStatus: 'processed', processNote: `Earlier clock-in updated (${timeStr})` },
      });
    } else {
      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { attendanceId: attendance.id, processStatus: 'skipped', processNote: 'Entry punch (not earlier than existing clock-in)' },
      });
    }
  } else if (
    attendance.checkIn &&
    (direction === 'out' || (!direction && punchDateTime > attendance.checkIn))
  ) {
    // Update checkOut if: no checkOut yet, OR this punch is LATER than current checkOut (last out wins)
    const isLater = !attendance.checkOut || punchDateTime > attendance.checkOut;
    if (isLater) {
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
        data: { attendanceId: attendance.id, processStatus: 'skipped', processNote: `Out punch not later than existing checkout` },
      });
    }
  } else {
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { attendanceId: attendance?.id, processStatus: 'skipped', processNote: 'Duplicate or out-of-order punch' },
    });
  }
}

// ─── Recalculate attendance from ALL punches (greytHR-style) ─────────────────
// This rebuilds checkIn, checkOut, workHours from scratch using all matched punches
// for a given user+date. Uses alternating IN/OUT logic like greytHR:
// 1st punch = IN, 2nd = OUT, 3rd = IN, 4th = OUT, etc. (chronological order)
async function recalculateAttendanceFromPunches(prisma, userId, date) {
  // Get ALL matched punches for this user+date, sorted by time
  const punches = await prisma.biometricPunch.findMany({
    where: { userId, punchDate: date, matchStatus: 'matched' },
    orderBy: { punchTime: 'asc' },
  });

  if (punches.length === 0) return null;

  // Parse all punch times
  const punchTimes = punches.map((p, idx) => ({
    id: p.id,
    time: new Date(p.punchTime.replace(' ', 'T') + '+05:30'),
    // greytHR-style: alternate IN/OUT based on chronological order (not device)
    direction: idx % 2 === 0 ? 'in' : 'out',
    timeStr: p.punchTime.slice(11, 16),
  }));

  // Also update the stored direction in BiometricPunch to match greytHR logic
  for (const p of punchTimes) {
    await prisma.biometricPunch.update({
      where: { id: p.id },
      data: { direction: p.direction },
    });
  }

  // First In = earliest punch, Last Out = latest punch
  const firstIn = punchTimes[0].time;
  const lastOut = punchTimes.length > 1 ? punchTimes[punchTimes.length - 1].time : null;

  // Calculate total span (First In to Last Out)
  const totalSpanHours = lastOut ? (lastOut.getTime() - firstIn.getTime()) / 3600000 : 0;

  // Calculate actual work hours by pairing alternating IN/OUT sessions
  let actualHours = 0;
  for (let i = 0; i < punchTimes.length - 1; i += 2) {
    const inPunch = punchTimes[i];
    const outPunch = punchTimes[i + 1];
    if (outPunch) {
      actualHours += (outPunch.time.getTime() - inPunch.time.getTime()) / 3600000;
    }
  }

  // Use actual session-based hours as workHours (like greytHR "Actual Work Hrs")
  const workHours = Math.round(actualHours * 100) / 100;
  const breakHours = Math.round((totalSpanHours - actualHours) * 100) / 100;

  // Build notes
  const firstInStr = punchTimes[0].timeStr;
  const lastOutStr = lastOut ? punchTimes[punchTimes.length - 1].timeStr : null;

  // Upsert attendance record
  let attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date } },
  });

  const attendanceData = {
    checkIn: firstIn,
    checkOut: lastOut || firstIn,
    workHours,
    status: 'present',
    notes: `Biometric: In ${firstInStr}${lastOutStr ? ` | Out ${lastOutStr}` : ''} | Actual ${workHours.toFixed(2)}h | Break ${breakHours.toFixed(2)}h`,
  };

  if (attendance) {
    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: attendanceData,
    });
  } else {
    attendance = await prisma.attendance.create({
      data: { userId, date, ...attendanceData },
    });
  }

  // Mark all punches as processed and linked to this attendance
  await prisma.biometricPunch.updateMany({
    where: { userId, punchDate: date, matchStatus: 'matched' },
    data: { attendanceId: attendance.id, processStatus: 'processed', processNote: 'Recalculated' },
  });

  return { attendance, punchCount: punches.length, workHours, breakHours, totalSpanHours: Math.round(totalSpanHours * 100) / 100 };
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
// Direction is assigned using greytHR-style alternating logic AFTER all punches
// are stored. First punch of the day = IN, second = OUT, third = IN, etc.
async function processAndStorePunches(prisma, device, rawPunches) {
  let inserted = 0, matched = 0, processed = 0;

  // Step 1: Store all raw punches (direction will be set later)
  const storedPunches = [];
  for (const p of rawPunches) {
    const punchDate = p.punchTime ? p.punchTime.slice(0, 10) : null;
    if (!p.enrollNumber || !p.punchTime || !punchDate) continue;

    const employee = await matchEmployee(p.enrollNumber, prisma);

    let punch;
    try {
      punch = await prisma.biometricPunch.create({
        data: {
          deviceId:     device.id,
          deviceSerial: device.serialNumber,
          enrollNumber: p.enrollNumber,
          punchTime:    p.punchTime,
          punchDate:    punchDate,
          direction:    null, // Will be set by alternating logic
          workCode:     p.workCode  || null,
          rawData:      null,
          userId:       employee ? employee.id : null,
          matchStatus:  employee ? 'matched' : 'unmatched',
          matchNote:    employee ? null : `No employee with bioDeviceId=${p.enrollNumber}`,
        },
      });
      inserted++;
      if (employee) matched++;
      storedPunches.push(punch);
    } catch (e) {
      if (e.code === 'P2002') continue; // Duplicate punch — skip
      throw e;
    }
  }

  // Step 2: For each user+date with new punches, recalculate alternating direction
  // and rebuild attendance using greytHR-style logic
  const userDatePairs = new Set();
  for (const punch of storedPunches) {
    if (punch.userId) {
      userDatePairs.add(`${punch.userId}|${punch.punchDate}`);
    }
  }

  for (const pair of userDatePairs) {
    const [uid, date] = pair.split('|');
    const userId = parseInt(uid);

    // Get ALL punches for this user+date sorted chronologically
    const allPunches = await prisma.biometricPunch.findMany({
      where: { userId, punchDate: date, matchStatus: 'matched' },
      orderBy: { punchTime: 'asc' },
    });

    // Assign alternating direction: 1st=in, 2nd=out, 3rd=in, 4th=out...
    for (let i = 0; i < allPunches.length; i++) {
      const dir = i % 2 === 0 ? 'in' : 'out';
      if (allPunches[i].direction !== dir) {
        await prisma.biometricPunch.update({
          where: { id: allPunches[i].id },
          data: { direction: dir },
        });
      }
      allPunches[i].direction = dir;
    }

    // Now process attendance using the corrected directions
    // Use recalculate logic for accurate session-based hours
    await recalculateAttendanceFromPunches(prisma, userId, date);
    processed += allPunches.filter(p => storedPunches.some(sp => sp.id === p.id)).length;
  }

  return { inserted, matched, processed };
}

// ─── Sync one device: fetch + process + update status ────────────────────────
async function syncDevice(prisma, device, lookbackDays = 1) {
  const startTime = Date.now();
  try {
    const rawPunches = await fetchFromDevice(device, lookbackDays);
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
async function syncAllDevices(prisma, lookbackDays = 1) {
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

    const result = await syncDevice(prisma, device, lookbackDays);
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
  recalculateAttendanceFromPunches,
  fetchFromDevice,
  syncDevice,
  syncAllDevices,
};
