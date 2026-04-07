const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { throwIfHasDependencies } = require('../utils/dependencyCheck');
const { matchEmployee, processPunch, processAndStorePunches, recalculateAttendanceFromPunches, syncAllDevices } = require('../services/biometric/biometricSyncService');

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// DEVICE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/biometric/devices — list all devices (admin auth OR agent key)
router.get('/devices', asyncHandler(async (req, res, next) => {
  // Allow local sync agent to fetch device list via agent key
  const agentKey = req.headers['x-agent-key'];
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  if (agentKey === expectedKey) {
    const devices = await req.prisma.biometricDevice.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return res.json(devices);
  }
  // Otherwise require admin auth
  next();
}), authenticate, requireAdmin, asyncHandler(async (req, res) => {
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
  await throwIfHasDependencies(req.prisma, 'BiometricDevice', id);
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
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  const { agentKey: bodyKey, deviceSerial, punches } = req.body || {};
  // Also accept key from x-agent-key header as fallback
  const agentKey = bodyKey || req.headers['x-agent-key'];

  if (agentKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid agent key' });
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

  const result = await processAndStorePunches(req.prisma, device, punches);

  // Update device sync status
  await req.prisma.biometricDevice.update({
    where: { id: device.id },
    data: {
      lastSyncAt:      new Date(),
      lastSyncStatus:  'success',
      lastSyncMessage: `${result.inserted} new punches, ${result.matched} matched, ${result.processed} processed`,
    },
  });

  res.json({ received: punches.length, ...result });
}));

// POST /api/biometric/sync-all — admin triggers server-side sync for all devices
router.post('/sync-all', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const lookbackDays = parseInt(req.body.lookbackDays) || 1;
  const result = await syncAllDevices(req.prisma, lookbackDays);
  res.json(result);
}));

// POST /api/biometric/sync-device/:id — admin triggers sync for a single device
router.post('/sync-device/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const lookbackDays = parseInt(req.body.lookbackDays) || 1;
  const device = await req.prisma.biometricDevice.findUnique({ where: { id } });
  if (!device) throw notFound('Device');
  if (!device.isActive) throw badRequest('Device is inactive');

  const { syncDevice } = require('../services/biometric/biometricSyncService');
  const result = await syncDevice(req.prisma, device, lookbackDays);
  res.json(result);
}));

// GET /api/biometric/cron-sync — Vercel Cron endpoint (no auth, uses secret)
router.get('/cron-sync', asyncHandler(async (req, res) => {
  const secret = req.headers['authorization'];
  const expected = `Bearer ${process.env.CRON_SECRET || 'cron-secret-key'}`;
  if (secret !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const result = await syncAllDevices(req.prisma);
  res.json({ ok: true, ...result });
}));

// POST /api/biometric/test-connection/:id — test eSSL SOAP connection for a device
router.post('/test-connection/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const device = await req.prisma.biometricDevice.findUnique({ where: { id } });
  if (!device) throw notFound('Device');

  const { fetchFromDevice } = require('../services/biometric/biometricSyncService');
  const startTime = Date.now();
  try {
    const punches = await fetchFromDevice(device, 1);
    const elapsed = Date.now() - startTime;

    // Sample first 5 punches for preview
    const sample = punches.slice(0, 5).map(p => ({
      enrollNumber: p.enrollNumber,
      punchTime: p.punchTime,
      direction: p.direction,
    }));

    // Count unique enroll numbers
    const uniqueEnrolls = [...new Set(punches.map(p => p.enrollNumber))];

    res.json({
      status: 'success',
      device: device.name,
      esslUrl: device.esslUrl,
      serialNumber: device.serialNumber,
      elapsed: `${elapsed}ms`,
      totalPunches: punches.length,
      uniqueEmployees: uniqueEnrolls.length,
      enrollNumbers: uniqueEnrolls,
      samplePunches: sample,
      message: punches.length > 0
        ? `Connected! Found ${punches.length} punches from ${uniqueEnrolls.length} employees`
        : 'Connected but no punches found for today. Try increasing lookback days.',
    });
  } catch (err) {
    res.json({
      status: 'failed',
      device: device.name,
      esslUrl: device.esslUrl,
      serialNumber: device.serialNumber,
      elapsed: `${Date.now() - startTime}ms`,
      error: err.message,
      troubleshooting: [
        'Check if cpserver/eSSL URL is reachable from this server',
        'Verify API credentials (apiUser, apiPassword, apiKey, companyCode)',
        'Verify serial number matches the device registered in eTimetracklite',
        'Check if eTimetracklite SOAP API is running on cpserver',
        `Tried URL: ${device.esslUrl}/IClock/WebService.asmx`,
      ],
    });
  }
}));

// POST /api/biometric/agent-sync — local agent pushes ALL devices data in one call
// The multi-device agent fetches from all eSSL devices locally and pushes everything here
router.post('/agent-sync', asyncHandler(async (req, res) => {
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  const agentKey = req.body.agentKey || req.headers['x-agent-key'];
  if (agentKey !== expectedKey) return res.status(401).json({ error: 'Invalid agent key' });

  const { devices: deviceData } = req.body;
  if (!Array.isArray(deviceData) || deviceData.length === 0) {
    return res.json({ message: 'No device data received', results: [] });
  }

  const results = [];
  for (const dd of deviceData) {
    const { deviceSerial, punches = [] } = dd;
    if (!deviceSerial) continue;

    const device = await req.prisma.biometricDevice.findUnique({
      where: { serialNumber: deviceSerial },
    });
    if (!device) {
      results.push({ device: deviceSerial, status: 'skipped', reason: 'Unknown device serial' });
      continue;
    }

    if (punches.length === 0) {
      // Update last sync even with 0 punches
      await req.prisma.biometricDevice.update({
        where: { id: device.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncMessage: '0 new punches, 0 matched, 0 processed',
        },
      });
      results.push({ device: device.name, status: 'success', inserted: 0, matched: 0, processed: 0 });
      continue;
    }

    const result = await processAndStorePunches(req.prisma, device, punches);

    await req.prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncMessage: `${result.inserted} new punches, ${result.matched} matched, ${result.processed} processed`,
      },
    });

    results.push({ device: device.name, status: 'success', ...result });
  }

  res.json({ received: deviceData.length, results });
}));

// ══════════════════════════════════════════════════════════════════════════════
// PUNCH MANAGEMENT & STATUS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/biometric/punches — list punches with filters
// ?date=2026-03-07&source=tunnel|neon&deviceId=1&matchStatus=unmatched&processStatus=pending&userId=5&page=1&limit=50
// source=tunnel → fetches from cpserver SQL via tunnel (all historical data)
// source=neon (default) → fetches from Neon DB (recent data with match status)
router.get('/punches', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { date, source, deviceId, matchStatus, processStatus, enrollNumber, userId, page = 1, limit = 50 } = req.query;

  // If source=tunnel, fetch from cpserver via tunnel API
  if (source === 'tunnel') {
    const { getTunnelUrl, fetchFromTunnel } = require('../services/biometric/tunnelConfig');
    const tunnelUrl = await getTunnelUrl(req.prisma);
    if (!tunnelUrl) return res.status(503).json({ error: 'Tunnel not connected. cpserver may be offline.' });

    const agentKey = process.env.BIOMETRIC_AGENT_KEY;
    try {
      const data = await fetchFromTunnel(tunnelUrl, `/api/punches?date=${date || new Date().toISOString().slice(0,10)}`, agentKey);

      // Get all employee mappings (bioDeviceId → employee name/id)
      const employees = await req.prisma.user.findMany({
        where: { bioDeviceId: { not: null } },
        select: { id: true, name: true, employeeId: true, bioDeviceId: true },
      });
      const empMap = {};
      employees.forEach(e => { empMap[e.bioDeviceId] = e; });

      // Get device names
      const devices = await req.prisma.biometricDevice.findMany({
        select: { id: true, name: true, serialNumber: true },
      });
      const deviceMap = {};
      devices.forEach(d => { deviceMap[d.serialNumber] = d; });

      // Map tunnel data with employee names and device names
      const punches = (data.punches || []).map((p, i) => {
        const emp = empMap[p.enrollNumber];
        const dev = deviceMap[p.deviceSn];
        return {
          id: i + 1,
          deviceSerial: p.deviceSn,
          enrollNumber: p.enrollNumber,
          punchTime: p.punchTime,
          punchDate: p.punchTime?.slice(0, 10),
          direction: p.direction,
          matchStatus: emp ? 'matched' : 'unmatched',
          processStatus: 'tunnel',
          source: 'cpserver-sql',
          employee: emp ? { id: emp.id, name: emp.name, employeeId: emp.employeeId } : null,
          device: dev ? { id: dev.id, name: dev.name } : null,
        };
      });

      // Apply filters
      let filtered = punches;
      if (enrollNumber) filtered = filtered.filter(p => p.enrollNumber === enrollNumber);
      if (userId) filtered = filtered.filter(p => p.employee?.id === parseInt(userId));
      if (matchStatus === 'matched') filtered = filtered.filter(p => p.employee);
      if (matchStatus === 'unmatched') filtered = filtered.filter(p => !p.employee);

      return res.json({ punches: filtered, total: filtered.length, page: 1, limit: filtered.length, source: 'tunnel' });
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }
  }

  // Default: fetch from Neon (recent data with full match/process info)
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (date)          where.punchDate    = date;
  if (deviceId)      where.deviceId     = parseInt(deviceId);
  if (matchStatus)   where.matchStatus  = matchStatus;
  if (processStatus) where.processStatus = processStatus;
  if (enrollNumber)  where.enrollNumber  = enrollNumber;
  if (userId)        where.userId        = parseInt(userId);

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

  res.json({ punches, total, page: parseInt(page), limit: parseInt(limit), source: 'neon' });
}));

// GET /api/biometric/punches/export — export filtered punches as CSV
router.get('/punches/export', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { date, deviceId, matchStatus, processStatus, enrollNumber, userId } = req.query;

  const where = {};
  if (date)          where.punchDate    = date;
  if (deviceId)      where.deviceId     = parseInt(deviceId);
  if (matchStatus)   where.matchStatus  = matchStatus;
  if (processStatus) where.processStatus = processStatus;
  if (enrollNumber)  where.enrollNumber  = enrollNumber;
  if (userId)        where.userId        = parseInt(userId);

  const punches = await req.prisma.biometricPunch.findMany({
    where,
    orderBy: { punchTime: 'desc' },
    take: 10000,
    include: {
      employee: { select: { name: true, employeeId: true } },
      device:   { select: { name: true } },
    },
  });

  const header = 'Employee,Employee ID,Enroll Number,Punch Date,Punch Time,Direction,Device,Match Status,Process Status\n';
  const rows = punches.map(p => [
    `"${(p.employee?.name || 'Unknown').replace(/"/g, '""')}"`,
    p.employee?.employeeId || '',
    p.enrollNumber,
    p.punchDate,
    p.punchTime,
    p.direction || '',
    `"${(p.device?.name || p.deviceSerial || '').replace(/"/g, '""')}"`,
    p.matchStatus,
    p.processStatus,
  ].join(','));

  const csv = header + rows.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="punch-log-${date || 'all'}.csv"`);
  res.send(csv);
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

// GET /api/biometric/status — dashboard summary (hybrid: Neon + Tunnel)
router.get('/status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { getTunnelUrl, fetchFromTunnel } = require('../services/biometric/tunnelConfig');

  const [devices, todayPunches, unmatchedToday, pendingProcess, totalPunchesNeon] = await Promise.all([
    req.prisma.biometricDevice.findMany({
      select: { id: true, name: true, serialNumber: true, isActive: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true },
    }),
    req.prisma.biometricPunch.count({ where: { punchDate: today } }),
    req.prisma.biometricPunch.count({ where: { punchDate: today, matchStatus: 'unmatched' } }),
    req.prisma.biometricPunch.count({ where: { processStatus: 'pending', matchStatus: 'matched' } }),
    req.prisma.biometricPunch.count(),
  ]);

  // Try to get total from tunnel (cpserver SQL — all historical data)
  let tunnelStats = null;
  try {
    const tunnelUrl = await getTunnelUrl(req.prisma);
    if (tunnelUrl) {
      const agentKey = process.env.BIOMETRIC_AGENT_KEY;
      tunnelStats = await fetchFromTunnel(tunnelUrl, '/api/stats', agentKey);
    }
  } catch (e) { /* tunnel may be offline */ }

  // Also get today's count from tunnel for accurate today's punches
  let tunnelTodayCount = 0;
  try {
    const tunnelUrl = await getTunnelUrl(req.prisma);
    if (tunnelUrl) {
      const agentKey = process.env.BIOMETRIC_AGENT_KEY;
      const todayData = await fetchFromTunnel(tunnelUrl, `/api/punches?date=${today}`, agentKey);
      tunnelTodayCount = todayData?.count || 0;
    }
  } catch (e) { /* tunnel may be offline */ }

  res.json({
    devices,
    todayPunches: tunnelTodayCount || todayPunches,
    unmatchedToday,
    pendingProcess,
    totalPunches: tunnelStats?.totalRows || totalPunchesNeon,
    totalPunchesSource: tunnelStats ? 'cpserver-sql' : 'neon',
    todayPunchesSource: tunnelTodayCount ? 'cpserver-sql' : 'neon',
    date: today,
    tunnelStats,
  });
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

  // Get the punch to find its enrollNumber
  const punch = await req.prisma.biometricPunch.findUnique({ where: { id } });
  if (!punch) throw notFound('Punch');

  // Match ALL unmatched punches with the same enrollNumber (not just this one)
  const allUnmatched = await req.prisma.biometricPunch.findMany({
    where: { enrollNumber: punch.enrollNumber, matchStatus: 'unmatched' },
    select: { id: true },
  });

  let matched = 0;
  for (const p of allUnmatched) {
    await req.prisma.biometricPunch.update({
      where: { id: p.id },
      data: { userId, matchStatus: 'matched', matchNote: 'Manually assigned by admin', processStatus: 'pending' },
    });
    const fresh = await req.prisma.biometricPunch.findUnique({ where: { id: p.id } });
    await processPunch(fresh, req.prisma);
    matched++;
  }

  res.json({ message: `${matched} punch(es) assigned to ${employee.name}` });
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
// Also auto-rematches ALL unmatched punches for that enroll number
router.put('/mappings/:userId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const { bioDeviceId } = req.body;

  const user = await req.prisma.user.update({
    where: { id: userId },
    data: { bioDeviceId: bioDeviceId || null },
    select: { id: true, name: true, employeeId: true, bioDeviceId: true },
  });

  // Auto-rematch ALL unmatched punches for this enroll number
  let rematched = 0;
  if (bioDeviceId) {
    const unmatched = await req.prisma.biometricPunch.findMany({
      where: { enrollNumber: bioDeviceId, matchStatus: 'unmatched' },
      select: { id: true },
    });
    for (const punch of unmatched) {
      await req.prisma.biometricPunch.update({
        where: { id: punch.id },
        data: { userId, matchStatus: 'matched', matchNote: 'Auto-matched on mapping save', processStatus: 'pending' },
      });
      const fresh = await req.prisma.biometricPunch.findUnique({ where: { id: punch.id } });
      await processPunch(fresh, req.prisma);
      rematched++;
    }
  }

  res.json({ ...user, rematched });
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

// POST /api/biometric/recalculate — recalculate attendance from ALL punches for a user+date
// This rebuilds First In, Last Out, Actual Hours, Break Hours from scratch (like greytHR)
router.post('/recalculate', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { userId, date } = req.body;
  if (!userId && !date) throw badRequest('userId and/or date required');

  // If both userId and date: recalculate for one user+date
  if (userId && date) {
    const result = await recalculateAttendanceFromPunches(req.prisma, parseInt(userId), date);
    if (!result) return res.json({ message: 'No matched punches found for this user+date' });
    return res.json({ recalculated: 1, ...result });
  }

  // If only date: recalculate for ALL users who have punches on that date
  if (date) {
    const userIds = await req.prisma.biometricPunch.findMany({
      where: { punchDate: date, matchStatus: 'matched' },
      select: { userId: true },
      distinct: ['userId'],
    });

    let recalculated = 0;
    const results = [];
    for (const { userId: uid } of userIds) {
      if (!uid) continue;
      const result = await recalculateAttendanceFromPunches(req.prisma, uid, date);
      if (result) {
        recalculated++;
        results.push({ userId: uid, workHours: result.workHours, breakHours: result.breakHours });
      }
    }
    return res.json({ date, recalculated, results });
  }

  throw badRequest('Provide date, or userId+date');
}));

// POST /api/biometric/recalculate-all — bulk recalculate ALL employees for a month
// Accessible via agent key (no login needed) so it can be triggered remotely
router.post('/recalculate-all', asyncHandler(async (req, res) => {
  // Auth: admin login OR agent key
  const agentKey = req.headers['x-agent-key'] || req.body?.agentKey;
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  const isAgent = agentKey === expectedKey;

  if (!isAgent) {
    // Fall back to admin auth check
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'team_lead')) {
      return res.status(401).json({ error: 'Agent key or admin login required' });
    }
  }

  const { month, startDay, endDay } = req.body; // "YYYY-MM", optional day range
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw badRequest('month required in YYYY-MM format');

  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const fromDay = startDay ? Math.max(1, parseInt(startDay)) : 1;
  const toDay = endDay ? Math.min(lastDay, parseInt(endDay)) : lastDay;

  let totalRecalculated = 0;
  const dailyResults = [];

  for (let day = fromDay; day <= toDay; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;

    const userIds = await req.prisma.biometricPunch.findMany({
      where: { punchDate: date, matchStatus: 'matched' },
      select: { userId: true },
      distinct: ['userId'],
    });

    let dayCount = 0;
    for (const { userId: uid } of userIds) {
      if (!uid) continue;
      const result = await recalculateAttendanceFromPunches(req.prisma, uid, date);
      if (result) dayCount++;
    }

    if (dayCount > 0) {
      totalRecalculated += dayCount;
      dailyResults.push({ date, employees: dayCount });
    }
  }

  res.json({ month, totalRecalculated, days: dailyResults.length, details: dailyResults });
}));

// GET /api/biometric/attendance-coverage?month=YYYY-MM — check how many employees have attendance data
router.get('/attendance-coverage', asyncHandler(async (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  if (agentKey !== expectedKey) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'team_lead')) {
      return res.status(401).json({ error: 'Agent key or admin login required' });
    }
  }

  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw badRequest('month required in YYYY-MM format');

  const employees = await req.prisma.user.findMany({
    where: { status: { in: ['active', 'on_notice'] } },
    select: { id: true, name: true, employeeId: true },
  });

  const records = await req.prisma.attendance.findMany({
    where: { date: { startsWith: month } },
    select: { userId: true, date: true, checkIn: true, status: true },
  });

  const byUser = {};
  records.forEach(r => {
    if (!byUser[r.userId]) byUser[r.userId] = { present: 0, withCheckIn: 0, total: 0 };
    byUser[r.userId].total++;
    if (r.status === 'present' || r.status === 'half_day' || r.status === 'late') byUser[r.userId].present++;
    if (r.checkIn) byUser[r.userId].withCheckIn++;
  });

  const summary = employees.map(e => ({
    employeeId: e.employeeId,
    name: e.name,
    present: byUser[e.id]?.present || 0,
    withCheckIn: byUser[e.id]?.withCheckIn || 0,
    totalRecords: byUser[e.id]?.total || 0,
  }));

  const withData = summary.filter(e => e.present > 0).length;
  res.json({ month, totalEmployees: employees.length, withPresent: withData, noData: employees.length - withData, employees: summary });
}));

// POST /api/biometric/purge-neon — delete all old BiometricPunch from Neon (admin only)
// Data is safe in cpserver SQL. This just frees Neon space.
router.post('/purge-neon', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { keepDays = 0 } = req.body; // 0 = delete ALL, 7 = keep last 7 days
  const total = await req.prisma.biometricPunch.count();

  let deleted;
  if (keepDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    deleted = await req.prisma.biometricPunch.deleteMany({ where: { punchDate: { lt: cutoffDate } } });
  } else {
    deleted = await req.prisma.biometricPunch.deleteMany();
  }

  const remaining = await req.prisma.biometricPunch.count();
  res.json({
    message: `Purged ${deleted.count} punches from Neon. Data safe in cpserver SQL.`,
    before: total,
    deleted: deleted.count,
    remaining,
  });
}));

// ══════════════════════════════════════════════════════════════════════════════
// TUNNEL MANAGEMENT (cpserver ↔ Vercel bridge)
// ══════════════════════════════════════════════════════════════════════════════
const { getTunnelUrl, setTunnelUrl, fetchFromTunnel } = require('../services/biometric/tunnelConfig');

// POST /api/biometric/register-tunnel — cpserver registers its tunnel URL on startup
router.post('/register-tunnel', asyncHandler(async (req, res) => {
  const agentKey = req.headers['x-agent-key'] || req.body.agentKey;
  const expectedKey = process.env.BIOMETRIC_AGENT_KEY;
  if (agentKey !== expectedKey) return res.status(401).json({ error: 'Invalid agent key' });

  const { tunnelUrl } = req.body;
  if (!tunnelUrl) return res.status(400).json({ error: 'tunnelUrl required' });

  await setTunnelUrl(req.prisma, tunnelUrl);
  console.log(`[Biometric] Tunnel URL registered: ${tunnelUrl}`);
  res.json({ message: 'Tunnel URL registered', tunnelUrl });
}));

// GET /api/biometric/tunnel-status — check if tunnel is reachable
router.get('/tunnel-status', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const tunnelUrl = await getTunnelUrl(req.prisma);
  if (!tunnelUrl) return res.json({ configured: false, connected: false });

  try {
    const agentKey = process.env.BIOMETRIC_AGENT_KEY;
    const health = await fetchFromTunnel(tunnelUrl, '/health', agentKey);
    res.json({ connected: true, tunnelUrl, serverTime: health.time });
  } catch (err) {
    res.json({ connected: false, tunnelUrl, error: err.message });
  }
}));

// GET /api/biometric/tunnel-punches — proxy punch queries to cpserver via tunnel
router.get('/tunnel-punches', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const tunnelUrl = await getTunnelUrl(req.prisma);
  if (!tunnelUrl) return res.status(503).json({ error: 'Tunnel not connected. cpserver may be offline.' });

  const agentKey = process.env.BIOMETRIC_AGENT_KEY;
  const { date, start, end } = req.query;

  try {
    let data;
    if (date) {
      data = await fetchFromTunnel(tunnelUrl, `/api/punches?date=${date}`, agentKey);
    } else if (start && end) {
      data = await fetchFromTunnel(tunnelUrl, `/api/punches/range?start=${start}&end=${end}`, agentKey);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      data = await fetchFromTunnel(tunnelUrl, `/api/punches?date=${today}`, agentKey);
    }
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}));

module.exports = router;
