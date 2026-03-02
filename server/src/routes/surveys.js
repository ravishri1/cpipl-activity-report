const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper: check if user is admin or team lead
function isAdmin(user) {
  return user.role === 'admin' || user.role === 'team_lead';
}

// --------------------------------------------------------------------------
// GET /admin/all — List ALL surveys (active + inactive) with response counts
// --------------------------------------------------------------------------
router.get('/admin/all', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const surveys = await req.prisma.survey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { responses: true } },
      },
    });

    const result = surveys.map((s) => ({
      ...s,
      questions: JSON.parse(s.questions),
      responseCount: s._count.responses,
      _count: undefined,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching all surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

// --------------------------------------------------------------------------
// GET / — List all active surveys for any authenticated user
// --------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const now = new Date();

    const surveys = await req.prisma.survey.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { responses: true } },
        responses: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
    });

    const result = surveys.map((s) => ({
      ...s,
      questions: JSON.parse(s.questions),
      responseCount: s._count.responses,
      hasResponded: s.responses.length > 0,
      responses: undefined,
      _count: undefined,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

// --------------------------------------------------------------------------
// POST / — Create survey (admin only)
// --------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, description, type, questions, isAnonymous, expiresAt, companyId } = req.body;

    if (!title || !questions) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions must be a non-empty array' });
    }

    const survey = await req.prisma.survey.create({
      data: {
        title,
        description: description || null,
        type: type || 'custom',
        questions: JSON.stringify(questions),
        isAnonymous: isAnonymous || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        companyId: companyId || null,
        createdBy: req.user.id,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      ...survey,
      questions: JSON.parse(survey.questions),
    });
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ error: 'Failed to create survey' });
  }
});

// --------------------------------------------------------------------------
// GET /:id — Get survey detail with questions
// --------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' });
    }

    const survey = await req.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        responses: isAdmin(req.user)
          ? {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            }
          : {
              where: { userId: req.user.id },
            },
        _count: { select: { responses: true } },
      },
    });

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const parsed = {
      ...survey,
      questions: JSON.parse(survey.questions),
      responseCount: survey._count.responses,
      _count: undefined,
    };

    if (isAdmin(req.user)) {
      // Admin sees all responses with parsed answers
      parsed.responses = survey.responses.map((r) => ({
        ...r,
        answers: JSON.parse(r.answers),
      }));
    } else {
      // Regular user sees only own response
      const own = survey.responses[0] || null;
      parsed.myResponse = own ? { ...own, answers: JSON.parse(own.answers) } : null;
      parsed.responses = undefined;
    }

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
});

// --------------------------------------------------------------------------
// PUT /:id — Update survey (admin only)
// --------------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' });
    }

    const existing = await req.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!existing) {
      return res.status(404).json({ error: 'Survey not found' });
    }

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
      where: { id: surveyId },
      data,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({
      ...updated,
      questions: JSON.parse(updated.questions),
    });
  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({ error: 'Failed to update survey' });
  }
});

// --------------------------------------------------------------------------
// DELETE /:id — Soft delete survey (set isActive=false, admin only)
// --------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' });
    }

    const existing = await req.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!existing) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    await req.prisma.survey.update({
      where: { id: surveyId },
      data: { isActive: false },
    });

    res.json({ message: 'Survey deactivated successfully' });
  } catch (error) {
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: 'Failed to delete survey' });
  }
});

// --------------------------------------------------------------------------
// POST /:id/respond — Submit a survey response
// --------------------------------------------------------------------------
router.post('/:id/respond', async (req, res) => {
  try {
    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' });
    }

    const survey = await req.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (!survey.isActive) {
      return res.status(400).json({ error: 'Survey is no longer active' });
    }

    if (survey.expiresAt && new Date(survey.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Survey has expired' });
    }

    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be a non-empty array' });
    }

    // Check for duplicate response
    const existingResponse = await req.prisma.surveyResponse.findUnique({
      where: {
        surveyId_userId: {
          surveyId,
          userId: req.user.id,
        },
      },
    });

    if (existingResponse) {
      return res.status(409).json({ error: 'You have already responded to this survey' });
    }

    const response = await req.prisma.surveyResponse.create({
      data: {
        surveyId,
        userId: survey.isAnonymous ? null : req.user.id,
        answers: JSON.stringify(answers),
      },
    });

    res.status(201).json({
      ...response,
      answers: JSON.parse(response.answers),
    });
  } catch (error) {
    // Handle unique constraint violation as a fallback
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You have already responded to this survey' });
    }
    console.error('Error submitting response:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// --------------------------------------------------------------------------
// GET /:id/results — Admin only. Aggregated results for a survey.
// --------------------------------------------------------------------------
router.get('/:id/results', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: 'Invalid survey ID' });
    }

    const survey = await req.prisma.survey.findUnique({
      where: { id: surveyId },
      include: { responses: true },
    });

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const questions = JSON.parse(survey.questions);
    const allAnswers = survey.responses.map((r) => JSON.parse(r.answers));
    const totalResponses = survey.responses.length;

    // Count total active employees for response rate
    const totalEmployees = await req.prisma.user.count({
      where: { isActive: true },
    });

    const responseRate =
      totalEmployees > 0 ? Math.round((totalResponses / totalEmployees) * 100) : 0;

    // Aggregate results per question
    const aggregated = questions.map((q, index) => {
      const questionAnswers = allAnswers
        .map((a) => {
          const entry = a.find((item) => item.questionIndex === index);
          return entry ? entry.answer : null;
        })
        .filter((a) => a !== null);

      if (q.type === 'multiple_choice' || q.type === 'rating' || q.type === 'yes_no') {
        // Count occurrences of each answer option
        const counts = {};
        questionAnswers.forEach((ans) => {
          const key = String(ans);
          counts[key] = (counts[key] || 0) + 1;
        });
        return {
          questionIndex: index,
          question: q.question,
          type: q.type,
          options: q.options || null,
          answerCounts: counts,
          totalAnswered: questionAnswers.length,
        };
      }

      // Text / open-ended questions
      return {
        questionIndex: index,
        question: q.question,
        type: q.type,
        textAnswers: questionAnswers,
        totalAnswered: questionAnswers.length,
      };
    });

    res.json({
      surveyId: survey.id,
      title: survey.title,
      totalResponses,
      totalEmployees,
      responseRate,
      questions: aggregated,
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch survey results' });
  }
});

module.exports = router;
