const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();

// ─── Helper: process a raw punch into attendance ──────────────────────────────
// punch.direction controls behaviour:
//   'in'  → always treat as clock-in  (set by device forceDirection for dedicated entry readers)
//   'out' → always treat as clock-out (set by device forceDirection for dedicated exit readers)
//   null  → time-based auto-detect    (Lucknow single-machine: later punch = clock-out)
async function processPunch(punch, prisma) {
  if (punch.processStatus === 'processed' || punch.processStatus === 'skipped') return;
  if (!punch.userId) {
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: { processStatus: 'skipped', processNote: 'No matched employee' },
    });
    return;
  }

  const punchDate  = punch.punchDate;            // "YYYY-MM-DD"
  const punchTime  = punch.punchTime;            // "YYYY-MM-DD HH:MM:SS"
  const timeStr    = punchTime.slice(11, 16);    // "HH:MM"
  const direction  = punch.direction;            // 'in' | 'out' | null

  // Build proper DateTime from punchTime string (IST → UTC for DB storage)
  const punchDateTime = new Date(punchTime.replace(' ', 'T') + '+05:30');

  // Look for existing attendance record for this employee on this date
  let attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: punch.userId, date: punchDate } },
  });

  if (!attendance) {
    // ── No attendance record yet for today ──────────────────────────────────
    if (direction === 'out') {
      // Exit punch arrived before any entry — skip (can't clock out without clock-in)
      await prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { processStatus: 'skipped', processNote: 'Exit punch but no clock-in found for this date' },
      });
      return;
    }

    // direction === 'in' or null → create clock-in
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
      data: {
        attendanceId:  attendance.id,
        processStatus: 'processed',
        processNote:   `Clock-in created (${timeStr})`,
      },
    });

  } else if (direction === 'in') {
    // ── Already have a record AND this is an explicit entry punch ───────────
    // Dedicated entry reader fired again (badge waved twice, door re-opened, etc.) — skip
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: {
        attendanceId:  attendance.id,
        processStatus: 'skipped',
        processNote:   'Duplicate entry punch (already clocked in)',
      },
    });

  } else if (
    !attendance.checkOut &&
    attendance.checkIn &&
    (direction === 'out' || (!direction && punchDateTime > attendance.checkIn))
  ) {
    // ── Clock-out: explicit 'out' punch OR later time-based punch ──────────
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
      data: {
        attendanceId:  attendance.id,
        processStatus: 'processed',
        processNote:   `Clock-out updated (${timeStr})`,
      },
    });

  } else {
    // ── All other cases: already fully processed or out-of-order ────────────
    await prisma.biometricPunch.update({
      where: { id: punch.id },
      data: {
        attendanceId:  attendance?.id,
        processStatus: 'skipped',
        processNote:   'Duplicate or out-of-order punch',
      },
    });
  }
}

// ─── Helper: match enroll number to employee ──────────────────────────────────
async function matchEmployee(enrollNumber, prisma) {
  return prisma.user.findFirst({
    where: { bioDeviceId: enrollNumber, isActive: true },
    select: { id: true, name: true, employeeId: true },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// DEVICE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/biometric/devices — list all devices
router.get('/devices', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const devices = await req.prisma.biometricDevice.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { punches: true } },
    },
  });
  res.json(devices);
}));

// POST /api/biometric/devices — add a device
router.post('/devices', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'serialNumber');
  const { name, serialNumber, location, ipAddress, esslUrl, apiUser, apiPassword, apiKey, companyCode, syncIntervalMin, forceDirection } = req.body;

  const device = await req.prisma.biometricDevice.create({
    data: {
      name,
      serialNumber,
      location:       location       || null,
      ipAddress:      ipAddress      || null,
      esslUrl:        esslUrl        || null,
      apiUser:        apiUser        || null,
      apiPassword:    apiPassword    || null,
      apiKey:         apiKey         || null,
      companyCode:    companyCode    || null,
      syncIntervalMin: syncIntervalMin ? parseInt(syncIntervalMin) : 5,
      forceDirection: forceDirection || null, // 'in' | 'out' | null
    },
  });
  res.status(201).json(device);
}));

// PUT /api/biometric/devices/:id — update device
router.put('/devices/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, serialNumber, location, ipAddress, esslUrl, apiUser, apiPassword, apiKey, companyCode, syncIntervalMin, isActive, forceDirection } = req.body;

  const device = await req.prisma.biometricDevice.update({
    where: { id },
    data: {
      ...(name            !== undefined && { name }),
      ...(serialNumber    !== undefined && { serialNumber }),
      ...(location        !== undefined && { location }),
      ...(ipAddress       !== undefined && { ipAddress }),
      ...(esslUrl         !== undefined && { esslUrl }),
      ...(apiUser         !== undefined && { apiUser }),
      ...(apiPassword     !== undefined && { apiPassword }),
      ...(apiKey          !== undefined && { apiKey }),
      ...(companyCode     !== undefined && { companyCode }),
      ...(syncIntervalMin !== undefined && { syncIntervalMin: parseInt(syncIntervalMin) }),
      ...(isActive        !== undefined && { isActive: Boolean(isActive) }),
      ...(forceDirection  !== undefined && { forceDirection: forceDirection || null }), // 'in' | 'out' | null
    },
  });
  res.json(device);
}));

// DELETE /api/biometric/devices/:id — remove device
router.delete('/devices/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.biometricDevice.delete({ where: { id } });
  res.json({ message: 'Device removed' });
}));

// ══════════════════════════════════════════════════════════════════════════════
// PUNCH INGESTION (called by local sync agent)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/biometric/sync — sync agent pushes punches from eSSL
// Body: { agentKey: "...", deviceSerial: "CUB7240300491", punches: [...] }
router.post('/sync', asyncHandler(async (req, res) => {
  // Simple shared-secret auth for the local agent
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY || 'biometric-sync-key';
  const { agentKey: bodyKey, deviceSerial, punches } = req.body || {};
  // Also accept key from x-agent-key header as fallback (Node.js https module may have body issues)
  const agentKey = bodyKey || req.headers['x-agent-key'];

  // Debug logging — temporary (remove after fixing)
  console.log('[BIOMETRIC SYNC DEBUG]', JSON.stringify({
    bodyType: typeof req.body,
    bodyKeyCount: Object.keys(req.body || {}).length,
    hasBodyKey: !!bodyKey,
    hasHeaderKey: !!req.headers['x-agent-key'],
    agentKeySource: bodyKey ? 'body' : req.headers['x-agent-key'] ? 'header' : 'none',
    agentKeyLen: agentKey ? agentKey.length : 0,
    expectedKeyLen: expectedKey.length,
    keysMatch: agentKey === expectedKey,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {}),
  }));

  if (agentKey !== expectedKey) {
    return res.status(401).json({
      error: 'Invalid agent key',
      debug: {
        receivedType: typeof agentKey,
        receivedLen: agentKey ? agentKey.length : 0,
        expectedLen: expectedKey.length,
        receivedFirst6: agentKey ? agentKey.slice(0, 6) : null,
        expectedFirst6: expectedKey.slice(0, 6),
        receivedLast4: agentKey ? agentKey.slice(-4) : null,
        expectedLast4: expectedKey.slice(-4),
        keySource: bodyKey ? 'body' : req.headers['x-agent-key'] ? 'header' : 'none',
        bodyKeyCount: Object.keys(req.body || {}).length,
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type'],
        hasBody: !!req.body,
        bodyType: typeof req.body,
      }
    });
  }
  if (!deviceSerial) throw badRequest('deviceSerial required');
  if (!Array.isArray(punches) || punches.length === 0) {
    return res.json({ received: 0, inserted: 0, matched: 0, processed: 0 });
  }

  // Find the registered device
  const device = await req.prisma.biometricDevice.findUnique({
    where: { serialNumber: deviceSerial },
  });
  if (!device) throw badRequest(`Unknown device serial: ${deviceSerial}`);

  let inserted = 0, matched = 0, processed = 0;

  for (const p of punches) {
    // p: { enrollNumber, punchTime, direction, workCode, rawData }
    const punchDate = p.punchTime ? p.punchTime.slice(0, 10) : null;
    if (!p.enrollNumber || !p.punchTime || !punchDate) continue;

    // Match employee
    const employee = await matchEmployee(p.enrollNumber, req.prisma);

    // Apply device-level direction override (Mumbai entry/exit dedicated readers)
    // null direction = auto-detect by time (Lucknow single-machine behaviour)
    const effectiveDirection = device.forceDirection || p.direction || null;

    // Upsert punch (skip exact duplicates)
    let punch;
    try {
      punch = await req.prisma.biometricPunch.create({
        data: {
          deviceId:     device.id,
          deviceSerial: deviceSerial,
          enrollNumber: p.enrollNumber,
          punchTime:    p.punchTime,
          punchDate:    punchDate,
          direction:    effectiveDirection,
          workCode:     p.workCode  || null,
          rawData:      p.rawData   ? JSON.stringify(p.rawData) : null,
          userId:       employee ? employee.id : null,
          matchStatus:  employee ? 'matched' : 'unmatched',
          matchNote:    employee ? null : `No employee with bioDeviceId=${p.enrollNumber}`,
        },
      });
      inserted++;
      if (employee) matched++;
    } catch (e) {
      // P2002 = unique constraint (duplicate punch) — skip silently
      if (e.code === 'P2002') continue;
      throw e;
    }

    // Auto-process matched punches
    if (punch && employee) {
      await processPunch(punch, req.prisma);
      processed++;
    }
  }

  // Update device sync status
  await req.prisma.biometricDevice.update({
    where: { id: device.id },
    data: {
      lastSyncAt:      new Date(),
      lastSyncStatus:  'success',
      lastSyncMessage: `${inserted} new punches, ${matched} matched, ${processed} processed`,
    },
  });

  res.json({ received: punches.length, inserted, matched, processed });
}));

// ══════════════════════════════════════════════════════════════════════════════
// PUNCH MANAGEMENT & STATUS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/biometric/punches — list punches with filters
// ?date=2026-03-07&deviceId=1&matchStatus=unmatched&processStatus=pending&page=1&limit=50
router.get('/punches', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { date, deviceId, matchStatus, processStatus, enrollNumber, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (date)          where.punchDate   = date;
  if (deviceId)      where.deviceId    = parseInt(deviceId);
  if (matchStatus)   where.matchStatus  = matchStatus;
  if (processStatus) where.processStatus = processStatus;
  if (enrollNumber)  where.enrollNumber  = enrollNumber;

  const [punches, total] = await Promise.all([
    req.prisma.biometricPunch.findMany({
      where,
      orderBy: { punchTime: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        employee: { select: { id: true, name: true, employeeId: true } },
        device:   { select: { id: true, name: true } },
      },
    }),
    req.prisma.biometricPunch.count({ where }),
  ]);

  res.json({ punches, total, page: parseInt(page), limit: parseInt(limit) });
}));

// GET /api/biometric/unmatched — unmatched punches (unknown employees)
router.get('/unmatched', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { date } = req.query;
  const where = { matchStatus: 'unmatched' };
  if (date) where.punchDate = date;

  const punches = await req.prisma.biometricPunch.findMany({
    where,
    orderBy: { punchTime: 'desc' },
    take: 200,
    include: { device: { select: { name: true } } },
  });

  // Group by enrollNumber to deduplicate
  const grouped = {};
  for (const p of punches) {
    if (!grouped[p.enrollNumber]) {
      grouped[p.enrollNumber] = { enrollNumber: p.enrollNumber, device: p.device?.name, count: 0, lastSeen: p.punchTime };
    }
    grouped[p.enrollNumber].count++;
    if (p.punchTime > grouped[p.enrollNumber].lastSeen) {
      grouped[p.enrollNumber].lastSeen = p.punchTime;
    }
  }

  res.json(Object.values(grouped));
}));

// GET /api/biometric/status — dashboard summary
router.get('/status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [devices, todayPunches, unmatchedToday, pendingProcess, totalPunches] = await Promise.all([
    req.prisma.biometricDevice.findMany({
      select: { id: true, name: true, serialNumber: true, isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true },
    }),
    req.prisma.biometricPunch.count({ where: { punchDate: today } }),
    req.prisma.biometricPunch.count({ where: { punchDate: today, matchStatus: 'unmatched' } }),
    req.prisma.biometricPunch.count({ where: { processStatus: 'pending', matchStatus: 'matched' } }),
    req.prisma.biometricPunch.count(),
  ]);

  res.json({ devices, todayPunches, unmatchedToday, pendingProcess, totalPunches, date: today });
}));

// POST /api/biometric/punches/:id/reprocess — manually retry processing a punch
router.post('/punches/:id/reprocess', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const punch = await req.prisma.biometricPunch.findUnique({ where: { id } });
  if (!punch) throw notFound('Punch');

  // Re-set to pending and try again
  await req.prisma.biometricPunch.update({ where: { id }, data: { processStatus: 'pending', processNote: null } });
  const fresh = await req.prisma.biometricPunch.findUnique({ where: { id } });
  await processPunch(fresh, req.prisma);

  const updated = await req.prisma.biometricPunch.findUnique({ where: { id } });
  res.json(updated);
}));

// POST /api/biometric/punches/:id/assign — manually assign unmatched punch to employee
router.post('/punches/:id/assign', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId');
  const id     = parseId(req.params.id);
  const userId = parseId(req.body.userId);

  const employee = await req.prisma.user.findUnique({ where: { id: userId } });
  if (!employee) throw notFound('Employee');

  // Also optionally save the bioDeviceId for future auto-matching
  if (req.body.saveMapping) {
    const punch = await req.prisma.biometricPunch.findUnique({ where: { id } });
    if (punch) {
      await req.prisma.user.update({ where: { id: userId }, data: { bioDeviceId: punch.enrollNumber } });
    }
  }

  await req.prisma.biometricPunch.update({
    where: { id },
    data: {
      userId:      userId,
      matchStatus: 'matched',
      matchNote:   'Manually assigned by admin',
      processStatus: 'pending',
    },
  });

  const fresh = await req.prisma.biometricPunch.findUnique({ where: { id } });
  await processPunch(fresh, req.prisma);

  res.json({ message: `Punch assigned to ${employee.name}` });
}));

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE BIOMETRIC ID MAPPING
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/biometric/mappings — employees with their bioDeviceId
router.get('/mappings', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const employees = await req.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employeeId: true, department: true, bioDeviceId: true },
    orderBy: { name: 'asc' },
  });
  res.json(employees);
}));

// PUT /api/biometric/mappings/:userId — set bioDeviceId for employee
router.put('/mappings/:userId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const { bioDeviceId } = req.body;

  const user = await req.prisma.user.update({
    where: { id: userId },
    data: { bioDeviceId: bioDeviceId || null },
    select: { id: true, name: true, employeeId: true, bioDeviceId: true },
  });
  res.json(user);
}));

// POST /api/biometric/rematch — re-run matching on all unmatched punches
router.post('/rematch', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const unmatched = await req.prisma.biometricPunch.findMany({
    where: { matchStatus: 'unmatched' },
    select: { id: true, enrollNumber: true },
  });

  let matched = 0;
  for (const punch of unmatched) {
    const employee = await matchEmployee(punch.enrollNumber, req.prisma);
    if (employee) {
      await req.prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { userId: employee.id, matchStatus: 'matched', matchNote: null, processStatus: 'pending' },
      });
      const fresh = await req.prisma.biometricPunch.findUnique({ where: { id: punch.id } });
      await processPunch(fresh, req.prisma);
      matched++;
    }
  }

  res.json({ checked: unmatched.length, matched, message: `Re-matched ${matched} previously unmatched punches` });
}));

module.exports = router;
