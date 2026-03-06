const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { notifyAllExcept } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

// GET /admin/all — List ALL surveys (active + inactive) with response counts
router.get('/admin/all', requireAdmin, asyncHandler(async (req, res) => {
  const surveys = await req.prisma.survey.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { responses: true } },
    },
  });

  res.json(surveys.map(s => ({
    ...s, questions: JSON.parse(s.questions), responseCount: s._count.responses, _count: undefined,
  })));
}));

// GET / — List all active surveys for any authenticated user
router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const surveys = await req.prisma.survey.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { responses: true } },
      responses: { where: { userId: req.user.id }, select: { id: true } },
    },
  });

  res.json(surveys.map(s => ({
    ...s, questions: JSON.parse(s.questions), responseCount: s._count.responses,
    hasResponded: s.responses.length > 0, responses: undefined, _count: undefined,
  })));
}));

// POST / — Create survey (admin only)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'questions');
  const { title, description, type, questions, isAnonymous, expiresAt, companyId } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) throw badRequest('Questions must be a non-empty array');

  const survey = await req.prisma.survey.create({
    data: {
      title, description: description || null, type: type || 'custom',
      questions: JSON.stringify(questions), isAnonymous: isAnonymous || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null, companyId: companyId || null,
      createdBy: req.user.id,
    },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  // Notify all employees about new survey
  notifyAllExcept(req.prisma, req.user.id, {
    type: 'survey',
    title: `New Survey: ${title}`,
    message: `Please participate in the "${title}" survey`,
    link: '/surveys',
  });

  res.status(201).json({ ...survey, questions: JSON.parse(survey.questions) });
}));

// GET /:id — Get survey detail with questions
router.get('/:id', asyncHandler(async (req, res) => {
  const surveyId = parseId(req.params.id);
  const survey = await req.prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      responses: isAdminRole(req.user)
        ? { include: { user: { select: { id: true, name: true, email: true } } } }
        : { where: { userId: req.user.id } },
      _count: { select: { responses: true } },
    },
  });
  if (!survey) throw notFound('Survey');

  const parsed = { ...survey, questions: JSON.parse(survey.questions), responseCount: survey._count.responses, _count: undefined };

  if (isAdminRole(req.user)) {
    parsed.responses = survey.responses.map(r => ({ ...r, answers: JSON.parse(r.answers) }));
  } else {
    const own = survey.responses[0] || null;
    parsed.myResponse = own ? { ...own, answers: JSON.parse(own.answers) } : null;
    parsed.responses = undefined;
  }

  res.json(parsed);
}));

// PUT /:id — Update survey (admin only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const surveyId = parseId(req.params.id);
  const existing = await req.prisma.survey.findUnique({ where: { id: surveyId } });
  if (!existing) throw notFound('Survey');

  const { title, description, type, questions, isActive, isAnonymous, expiresAt } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (type !== undefined) data.type = type;
  if (questions !== undefined) data.questions = JSON.stringify(questions);
  if (isActive !== undefined) data.isActive = isActive;
  if (isAnonymous !== undefined) data.isAnonymous = isAnonymous;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

  const updated = await req.prisma.survey.update({
    where: { id: surveyId }, data,
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  res.json({ ...updated, questions: JSON.parse(updated.questions) });
}));

// DELETE /:id — Soft delete survey (admin only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const surveyId = parseId(req.params.id);
  const existing = await req.prisma.survey.findUnique({ where: { id: surveyId } });
  if (!existing) throw notFound('Survey');

  await req.prisma.survey.update({ where: { id: surveyId }, data: { isActive: false } });
  res.json({ message: 'Survey deactivated successfully' });
}));

// POST /:id/respond — Submit a survey response
router.post('/:id/respond', asyncHandler(async (req, res) => {
  const surveyId = parseId(req.params.id);
  const survey = await req.prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound('Survey');
  if (!survey.isActive) throw badRequest('Survey is no longer active');
  if (survey.expiresAt && new Date(survey.expiresAt) < new Date()) throw badRequest('Survey has expired');

  const { answers } = req.body;
  if (!answers || !Array.isArray(answers)) throw badRequest('Answers must be a non-empty array');

  const existingResponse = await req.prisma.surveyResponse.findUnique({
    where: { surveyId_userId: { surveyId, userId: req.user.id } },
  });
  if (existingResponse) throw conflict('You have already responded to this survey');

  const response = await req.prisma.surveyResponse.create({
    data: {
      surveyId,
      userId: survey.isAnonymous ? null : req.user.id,
      answers: JSON.stringify(answers),
    },
  });

  res.status(201).json({ ...response, answers: JSON.parse(response.answers) });
}));

// GET /:id/results — Admin only. Aggregated results for a survey.
router.get('/:id/results', requireAdmin, asyncHandler(async (req, res) => {
  const surveyId = parseId(req.params.id);
  const survey = await req.prisma.survey.findUnique({
    where: { id: surveyId },
    include: { responses: true },
  });
  if (!survey) throw notFound('Survey');

  const questions = JSON.parse(survey.questions);
  const allAnswers = survey.responses.map(r => JSON.parse(r.answers));
  const totalResponses = survey.responses.length;
  const totalEmployees = await req.prisma.user.count({ where: { isActive: true } });
  const responseRate = totalEmployees > 0 ? Math.round((totalResponses / totalEmployees) * 100) : 0;

  const aggregated = questions.map((q, index) => {
    const questionAnswers = allAnswers
      .map(a => { const entry = a.find(item => item.questionIndex === index); return entry ? entry.answer : null; })
      .filter(a => a !== null);

    if (q.type === 'multiple_choice' || q.type === 'rating' || q.type === 'yes_no') {
      const counts = {};
      questionAnswers.forEach(ans => { const key = String(ans); counts[key] = (counts[key] || 0) + 1; });
      return { questionIndex: index, question: q.question, type: q.type, options: q.options || null, answerCounts: counts, totalAnswered: questionAnswers.length };
    }

    return { questionIndex: index, question: q.question, type: q.type, textAnswers: questionAnswers, totalAnswered: questionAnswers.length };
  });

  res.json({ surveyId: survey.id, title: survey.title, totalResponses, totalEmployees, responseRate, questions: aggregated });
}));

module.exports = router;
