const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

const VALID_CATEGORIES = ['general', 'compliance', 'technical', 'soft_skills', 'ai', 'onboarding'];

// ═══════════════════════════════════════════════════════
//  ADMIN: MODULE MANAGEMENT
// ═══════════════════════════════════════════════════════

// ─── 1. GET /modules ─── List all modules (admin sees all, employee sees active)
router.get('/modules', async (req, res) => {
  try {
    const { category } = req.query;
    const where = isAdmin(req) ? {} : { isActive: true };
    if (category && VALID_CATEGORIES.includes(category)) where.category = category;

    const modules = await req.prisma.trainingModule.findMany({
      where,
      include: {
        exams: { select: { id: true, totalPoints: true, timeLimit: true, isActive: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: [{ isMandatory: 'desc' }, { createdAt: 'desc' }],
    });

    // For employees, attach their attempt status
    if (!isAdmin(req)) {
      const attempts = await req.prisma.trainingAttempt.findMany({
        where: { userId: req.user.id, moduleId: { in: modules.map(m => m.id) } },
        orderBy: { completedAt: 'desc' },
      });
      const attemptMap = {};
      for (const a of attempts) {
        if (!attemptMap[a.moduleId]) attemptMap[a.moduleId] = a;
      }
      const result = modules.map(m => ({
        ...m,
        myBestAttempt: attemptMap[m.id] || null,
      }));
      return res.json(result);
    }

    res.json(modules);
  } catch (err) {
    console.error('GET /training/modules error:', err);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// ─── 2. POST /modules ─── Create module (admin)
router.post('/modules', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { title, description, category, content, duration, passingScore, isMandatory } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

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
  } catch (err) {
    console.error('POST /training/modules error:', err);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

// ─── 3. PUT /modules/:id ─── Update module (admin)
router.put('/modules/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
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
  } catch (err) {
    console.error('PUT /training/modules/:id error:', err);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

// ─── 4. GET /modules/:id ─── Single module detail
router.get('/modules/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const module = await req.prisma.trainingModule.findUnique({
      where: { id },
      include: {
        exams: { where: isAdmin(req) ? {} : { isActive: true } },
      },
    });
    if (!module) return res.status(404).json({ error: 'Module not found' });
    if (!isAdmin(req) && !module.isActive) return res.status(404).json({ error: 'Module not found' });

    // Get user's attempts
    if (!isAdmin(req)) {
      const attempts = await req.prisma.trainingAttempt.findMany({
        where: { userId: req.user.id, moduleId: id },
        orderBy: { startedAt: 'desc' },
      });
      return res.json({ ...module, myAttempts: attempts });
    }

    res.json(module);
  } catch (err) {
    console.error('GET /training/modules/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch module' });
  }
});

// ═══════════════════════════════════════════════════════
//  ADMIN: EXAM MANAGEMENT
// ═══════════════════════════════════════════════════════

// ─── 5. POST /exams ─── Create exam for a module (admin)
router.post('/exams', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { moduleId, questions, totalPoints, timeLimit } = req.body;
    if (!moduleId || !questions) return res.status(400).json({ error: 'moduleId and questions are required' });

    // Validate questions is valid JSON array
    let parsed;
    try {
      parsed = typeof questions === 'string' ? JSON.parse(questions) : questions;
      if (!Array.isArray(parsed)) throw new Error('Questions must be array');
    } catch {
      return res.status(400).json({ error: 'Questions must be a valid JSON array' });
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
  } catch (err) {
    console.error('POST /training/exams error:', err);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// ─── 6. PUT /exams/:id ─── Update exam (admin)
router.put('/exams/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
    const { questions, totalPoints, timeLimit, isActive } = req.body;
    const data = {};
    if (questions) data.questions = typeof questions === 'string' ? questions : JSON.stringify(questions);
    if (totalPoints !== undefined) data.totalPoints = parseInt(totalPoints);
    if (timeLimit !== undefined) data.timeLimit = timeLimit ? parseInt(timeLimit) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await req.prisma.trainingExam.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /training/exams/:id error:', err);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// ─── 7. GET /exams/:id ─── Get exam (for taking - hide correctAnswer for employees)
router.get('/exams/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exam = await req.prisma.trainingExam.findUnique({
      where: { id },
      include: { module: { select: { title: true, passingScore: true } } },
    });
    if (!exam || (!exam.isActive && !isAdmin(req))) return res.status(404).json({ error: 'Exam not found' });

    if (!isAdmin(req)) {
      // Strip correct answers for employees
      const questions = JSON.parse(exam.questions);
      const sanitized = questions.map(({ correctAnswer, ...rest }) => rest);
      return res.json({ ...exam, questions: JSON.stringify(sanitized) });
    }

    res.json(exam);
  } catch (err) {
    console.error('GET /training/exams/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// ═══════════════════════════════════════════════════════
//  EMPLOYEE: ATTEMPT EXAM
// ═══════════════════════════════════════════════════════

// ─── 8. POST /attempts ─── Submit exam attempt
router.post('/attempts', async (req, res) => {
  try {
    const { examId, answers, timeSpent } = req.body;
    if (!examId || !answers) return res.status(400).json({ error: 'examId and answers are required' });

    const exam = await req.prisma.trainingExam.findUnique({
      where: { id: parseInt(examId) },
      include: { module: true },
    });
    if (!exam || !exam.isActive) return res.status(404).json({ error: 'Exam not found' });

    // Parse and grade
    const questions = JSON.parse(exam.questions);
    let parsedAnswers;
    try {
      parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
    } catch {
      return res.status(400).json({ error: 'Invalid answers format' });
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
        moduleId: exam.moduleId,
        userId: req.user.id,
        answers: typeof answers === 'string' ? answers : JSON.stringify(answers),
        score: scorePercent,
        totalPoints: earnedPoints,
        passed,
        completedAt: new Date(),
        timeSpent: timeSpent ? parseInt(timeSpent) : null,
      },
    });

    res.status(201).json({
      ...attempt,
      scorePercent,
      passed,
      passingScore: exam.module.passingScore,
      earnedPoints,
      totalPoints: exam.totalPoints,
    });
  } catch (err) {
    console.error('POST /training/attempts error:', err);
    res.status(500).json({ error: 'Failed to submit attempt' });
  }
});

// ─── 9. GET /my-progress ─── Employee training progress
router.get('/my-progress', async (req, res) => {
  try {
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
      status: bestByModule[m.id]
        ? (bestByModule[m.id].passed ? 'passed' : 'attempted')
        : 'not_started',
    }));

    const mandatoryTotal = modules.filter(m => m.isMandatory).length;
    const mandatoryCompleted = modules.filter(m => m.isMandatory && bestByModule[m.id]?.passed).length;

    res.json({
      modules: progress,
      summary: {
        totalModules: modules.length,
        completed: Object.values(bestByModule).filter(a => a.passed).length,
        mandatoryTotal,
        mandatoryCompleted,
        overallScore: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length) : 0,
      },
    });
  } catch (err) {
    console.error('GET /training/my-progress error:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ─── 10. GET /dashboard ─── Admin training dashboard
router.get('/dashboard', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

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
        ...m,
        totalAttempts: modAttempts.length,
        uniqueAttemptees: uniqueUsers.size,
        passedCount: passedUsers.size,
        completionRate: activeUsers > 0 ? Math.round((passedUsers.size / activeUsers) * 100) : 0,
        avgScore,
      };
    });

    res.json({ moduleStats, activeUsers, totalAttempts: attempts.length });
  } catch (err) {
    console.error('GET /training/dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ─── 11. GET /attempts/module/:moduleId ─── All attempts for a module (admin)
router.get('/attempts/module/:moduleId', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const moduleId = parseInt(req.params.moduleId);
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

    const result = attempts.map(a => ({
      ...a,
      user: userMap[a.userId] || { name: 'Unknown' },
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /training/attempts/module/:moduleId error:', err);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

module.exports = router;
