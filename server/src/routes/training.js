const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'team_lead'; }
const VALID_CATEGORIES = ['general', 'compliance', 'technical', 'soft_skills', 'ai', 'onboarding'];

// ═══════════════════════════════════════════════════════
//  ADMIN: MODULE MANAGEMENT
// ═══════════════════════════════════════════════════════

// GET /modules — List all modules (admin sees all, employee sees active)
router.get('/modules', asyncHandler(async (req, res) => {
  const { category } = req.query;
  const where = isAdminRole(req.user) ? {} : { isActive: true };
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;

  const modules = await req.prisma.trainingModule.findMany({
    where,
    include: {
      exams: { select: { id: true, totalPoints: true, timeLimit: true, isActive: true } },
      _count: { select: { attempts: true } },
    },
    orderBy: [{ isMandatory: 'desc' }, { createdAt: 'desc' }],
  });

  if (!isAdminRole(req.user)) {
    const attempts = await req.prisma.trainingAttempt.findMany({
      where: { userId: req.user.id, moduleId: { in: modules.map(m => m.id) } },
      orderBy: { completedAt: 'desc' },
    });
    const attemptMap = {};
    for (const a of attempts) {
      if (!attemptMap[a.moduleId]) attemptMap[a.moduleId] = a;
    }
    return res.json(modules.map(m => ({ ...m, myBestAttempt: attemptMap[m.id] || null })));
  }

  res.json(modules);
}));

// POST /modules — Create module (admin)
router.post('/modules', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'content');
  const { title, description, category, content, duration, passingScore, isMandatory } = req.body;

  const module = await req.prisma.trainingModule.create({
    data: {
      title,
      description: description || null,
      category: category && VALID_CATEGORIES.includes(category) ? category : 'general',
      content,
      duration: duration ? parseInt(duration) : null,
      passingScore: passingScore ? parseInt(passingScore) : 70,
      isMandatory: isMandatory || false,
      createdBy: req.user.id,
    },
  });
  res.status(201).json(module);
}));

// PUT /modules/:id — Update module (admin)
router.put('/modules/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { title, description, category, content, duration, passingScore, isMandatory, isActive } = req.body;
  const data = {};
  if (title) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (category && VALID_CATEGORIES.includes(category)) data.category = category;
  if (content) data.content = content;
  if (duration !== undefined) data.duration = duration ? parseInt(duration) : null;
  if (passingScore !== undefined) data.passingScore = parseInt(passingScore);
  if (isMandatory !== undefined) data.isMandatory = isMandatory;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await req.prisma.trainingModule.update({ where: { id }, data });
  res.json(updated);
}));

// GET /modules/:id — Single module detail
router.get('/modules/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const module = await req.prisma.trainingModule.findUnique({
    where: { id },
    include: { exams: { where: isAdminRole(req.user) ? {} : { isActive: true } } },
  });
  if (!module) throw notFound('Module');
  if (!isAdminRole(req.user) && !module.isActive) throw notFound('Module');

  if (!isAdminRole(req.user)) {
    const attempts = await req.prisma.trainingAttempt.findMany({
      where: { userId: req.user.id, moduleId: id },
      orderBy: { startedAt: 'desc' },
    });
    return res.json({ ...module, myAttempts: attempts });
  }

  res.json(module);
}));

// ═══════════════════════════════════════════════════════
//  ADMIN: EXAM MANAGEMENT
// ═══════════════════════════════════════════════════════

// POST /exams — Create exam for a module (admin)
router.post('/exams', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'moduleId', 'questions');
  const { moduleId, questions, totalPoints, timeLimit } = req.body;

  let parsed;
  try {
    parsed = typeof questions === 'string' ? JSON.parse(questions) : questions;
    if (!Array.isArray(parsed)) throw new Error();
  } catch {
    throw badRequest('Questions must be a valid JSON array');
  }

  const exam = await req.prisma.trainingExam.create({
    data: {
      moduleId: parseInt(moduleId),
      questions: typeof questions === 'string' ? questions : JSON.stringify(questions),
      totalPoints: totalPoints ? parseInt(totalPoints) : 100,
      timeLimit: timeLimit ? parseInt(timeLimit) : null,
    },
  });
  res.status(201).json(exam);
}));

// PUT /exams/:id — Update exam (admin)
router.put('/exams/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { questions, totalPoints, timeLimit, isActive } = req.body;
  const data = {};
  if (questions) data.questions = typeof questions === 'string' ? questions : JSON.stringify(questions);
  if (totalPoints !== undefined) data.totalPoints = parseInt(totalPoints);
  if (timeLimit !== undefined) data.timeLimit = timeLimit ? parseInt(timeLimit) : null;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await req.prisma.trainingExam.update({ where: { id }, data });
  res.json(updated);
}));

// GET /exams/:id — Get exam (hide correctAnswer for employees)
router.get('/exams/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const exam = await req.prisma.trainingExam.findUnique({
    where: { id },
    include: { module: { select: { title: true, passingScore: true } } },
  });
  if (!exam || (!exam.isActive && !isAdminRole(req.user))) throw notFound('Exam');

  if (!isAdminRole(req.user)) {
    const questions = JSON.parse(exam.questions);
    const sanitized = questions.map(({ correctAnswer, ...rest }) => rest);
    return res.json({ ...exam, questions: JSON.stringify(sanitized) });
  }

  res.json(exam);
}));

// ═══════════════════════════════════════════════════════
//  EMPLOYEE: ATTEMPT EXAM
// ═══════════════════════════════════════════════════════

// POST /attempts — Submit exam attempt
router.post('/attempts', asyncHandler(async (req, res) => {
  requireFields(req.body, 'examId', 'answers');
  const { examId, answers, timeSpent } = req.body;

  const exam = await req.prisma.trainingExam.findUnique({
    where: { id: parseInt(examId) },
    include: { module: true },
  });
  if (!exam || !exam.isActive) throw notFound('Exam');

  const questions = JSON.parse(exam.questions);
  let parsedAnswers;
  try {
    parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
  } catch {
    throw badRequest('Invalid answers format');
  }

  let earnedPoints = 0;
  for (const ans of parsedAnswers) {
    const q = questions[ans.questionIndex];
    if (q && String(ans.selectedAnswer) === String(q.correctAnswer)) {
      earnedPoints += (q.points || Math.floor(exam.totalPoints / questions.length));
    }
  }

  const scorePercent = exam.totalPoints > 0 ? Math.round((earnedPoints / exam.totalPoints) * 100) : 0;
  const passed = scorePercent >= exam.module.passingScore;

  const attempt = await req.prisma.trainingAttempt.create({
    data: {
      moduleId: exam.moduleId, userId: req.user.id,
      answers: typeof answers === 'string' ? answers : JSON.stringify(answers),
      score: scorePercent, totalPoints: earnedPoints, passed,
      completedAt: new Date(), timeSpent: timeSpent ? parseInt(timeSpent) : null,
    },
  });

  res.status(201).json({ ...attempt, scorePercent, passed, passingScore: exam.module.passingScore, earnedPoints, totalPoints: exam.totalPoints });
}));

// GET /my-progress — Employee training progress
router.get('/my-progress', asyncHandler(async (req, res) => {
  const modules = await req.prisma.trainingModule.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true, isMandatory: true, passingScore: true },
  });

  const attempts = await req.prisma.trainingAttempt.findMany({
    where: { userId: req.user.id },
    orderBy: { score: 'desc' },
  });

  const bestByModule = {};
  for (const a of attempts) {
    if (!bestByModule[a.moduleId] || a.score > bestByModule[a.moduleId].score) {
      bestByModule[a.moduleId] = a;
    }
  }

  const progress = modules.map(m => ({
    ...m,
    bestAttempt: bestByModule[m.id] || null,
    status: bestByModule[m.id] ? (bestByModule[m.id].passed ? 'passed' : 'attempted') : 'not_started',
  }));

  const mandatoryTotal = modules.filter(m => m.isMandatory).length;
  const mandatoryCompleted = modules.filter(m => m.isMandatory && bestByModule[m.id]?.passed).length;

  res.json({
    modules: progress,
    summary: {
      totalModules: modules.length,
      completed: Object.values(bestByModule).filter(a => a.passed).length,
      mandatoryTotal, mandatoryCompleted,
      overallScore: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0,
    },
  });
}));

// GET /dashboard — Admin training dashboard
router.get('/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const [modules, attempts, activeUsers] = await Promise.all([
    req.prisma.trainingModule.findMany({ where: { isActive: true }, select: { id: true, title: true, isMandatory: true } }),
    req.prisma.trainingAttempt.findMany({ include: { module: { select: { title: true } } } }),
    req.prisma.user.count({ where: { isActive: true } }),
  ]);

  const moduleStats = modules.map(m => {
    const modAttempts = attempts.filter(a => a.moduleId === m.id);
    const uniqueUsers = new Set(modAttempts.map(a => a.userId));
    const passedUsers = new Set(modAttempts.filter(a => a.passed).map(a => a.userId));
    const avgScore = modAttempts.length > 0 ? Math.round(modAttempts.reduce((s, a) => s + a.score, 0) / modAttempts.length) : 0;

    return {
      ...m, totalAttempts: modAttempts.length, uniqueAttemptees: uniqueUsers.size,
      passedCount: passedUsers.size,
      completionRate: activeUsers > 0 ? Math.round((passedUsers.size / activeUsers) * 100) : 0,
      avgScore,
    };
  });

  res.json({ moduleStats, activeUsers, totalAttempts: attempts.length });
}));

// GET /attempts/module/:moduleId — All attempts for a module (admin)
router.get('/attempts/module/:moduleId', requireAdmin, asyncHandler(async (req, res) => {
  const moduleId = parseId(req.params.moduleId);
  const attempts = await req.prisma.trainingAttempt.findMany({
    where: { moduleId },
    orderBy: { completedAt: 'desc' },
  });

  const userIds = [...new Set(attempts.map(a => a.userId))];
  const users = await req.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, department: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(attempts.map(a => ({ ...a, user: userMap[a.userId] || { name: 'Unknown' } })));
}));

module.exports = router;
