const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// Helper function to calculate 90-day deadline from publication
const getCompletionDeadline = (publishedAt) => {
  if (!publishedAt) return null;
  const deadline = new Date(publishedAt);
  deadline.setDate(deadline.getDate() + 90);
  return deadline;
};

// Helper function to check if completion is within deadline
const isWithinDeadline = (completedAt, deadline) => {
  if (!deadline) return true;
  return new Date(completedAt) <= new Date(deadline);
};

// Helper function to award points (logs to PointLog — no points field on User)
const awardPoints = async (userId, points, reason, prisma) => {
  await prisma.pointLog.create({
    data: {
      userId,
      points,
      date: new Date().toISOString().slice(0, 10),
      source: 'training',
      description: reason,
    }
  });
};

// ═══════════════════════════════════════════════
// TRAINING MODULES - Browse & View
// ═══════════════════════════════════════════════

// GET all training modules (general + user's department)
router.get('/modules', asyncHandler(async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id }
  });

  const modules = await req.prisma.trainingModule.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: 'general' },
        { scope: 'department', departmentName: user.department }
      ]
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      exams: true,
      _count: {
        select: { contributions: true, assignments: true, attempts: true }
      }
    },
    orderBy: [{ isMandatory: 'desc' }, { createdAt: 'desc' }]
  });

  // Enrich with user's assignment info
  const enriched = await Promise.all(modules.map(async (module) => {
    const assignment = await req.prisma.trainingAssignment.findFirst({
      where: {
        moduleId: module.id,
        assignedToId: req.user.id
      }
    });
    return {
      ...module,
      userAssignment: assignment,
      completionPointsValue: module.completionPointsValue || 25,
      daysUntilDeadline: assignment?.completionDeadline 
        ? Math.ceil((new Date(assignment.completionDeadline) - new Date()) / (1000 * 60 * 60 * 24))
        : null
    };
  }));

  res.json(enriched);
}));

// GET single training module with contributions
router.get('/modules/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const module = await req.prisma.trainingModule.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      exams: { include: { _count: { select: { attempts: true } } } },
      contributions: {
        where: { status: { in: ['approved', 'implemented'] } },
        include: {
          contributor: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } }
        }
      },
      _count: {
        select: { 
          contributions: true, 
          assignments: true, 
          attempts: true 
        }
      }
    }
  });

  if (!module) throw notFound('Training Module');
  
  // Get user's assignment details
  const userAssignment = await req.prisma.trainingAssignment.findFirst({
    where: {
      moduleId: module.id,
      assignedToId: req.user.id
    }
  });

  res.json({
    ...module,
    userAssignment,
    completionPointsValue: module.completionPointsValue || 25
  });
}));

// ═══════════════════════════════════════════════
// TRAINING MODULES - Admin CRUD
// ═══════════════════════════════════════════════

// POST create training module
router.post('/modules', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'content', 'category');
  requireEnum(req.body.scope || 'general', ['general', 'department'], 'scope');

  if (req.body.scope === 'department') {
    requireFields(req.body, 'departmentName');
  }

  const module = await req.prisma.trainingModule.create({
    data: {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      content: req.body.content,
      duration: req.body.duration,
      passingScore: req.body.passingScore || 70,
      isMandatory: req.body.isMandatory || false,
      scope: req.body.scope || 'general',
      departmentName: req.body.departmentName,
      createdBy: req.user.id,
      publishedAt: req.body.publishedAt || new Date(),
      completionPointsValue: req.body.completionPointsValue || 25
    },
    include: {
      creator: { select: { id: true, name: true } }
    }
  });

  res.status(201).json(module);
}));

// PUT update training module
router.put('/modules/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const module = await req.prisma.trainingModule.findUnique({ where: { id } });
  if (!module) throw notFound('Training Module');

  const updated = await req.prisma.trainingModule.update({
    where: { id },
    data: {
      title: req.body.title || module.title,
      description: req.body.description !== undefined ? req.body.description : module.description,
      content: req.body.content || module.content,
      category: req.body.category || module.category,
      duration: req.body.duration !== undefined ? req.body.duration : module.duration,
      isMandatory: req.body.isMandatory !== undefined ? req.body.isMandatory : module.isMandatory,
      isActive: req.body.isActive !== undefined ? req.body.isActive : module.isActive,
      completionPointsValue: req.body.completionPointsValue || module.completionPointsValue
    },
    include: { creator: { select: { id: true, name: true } } }
  });

  res.json(updated);
}));

// POST publish training module (set publishedAt)
router.post('/modules/:id/publish', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  
  const module = await req.prisma.trainingModule.findUnique({ where: { id } });
  if (!module) throw notFound('Training Module');

  const published = await req.prisma.trainingModule.update({
    where: { id },
    data: {
      publishedAt: new Date(),
      isActive: true
    }
  });

  res.json(published);
}));

// ═══════════════════════════════════════════════
// TRAINING ASSIGNMENTS - Manager assigns to reportees
// ═══════════════════════════════════════════════

// POST assign training to reportee
router.post('/assign', asyncHandler(async (req, res) => {
  requireFields(req.body, 'moduleId', 'assignedToId');

  const reportee = await req.prisma.user.findUnique({
    where: { id: parseInt(req.body.assignedToId) }
  });

  if (!reportee) throw notFound('Employee');

  const isManager = req.user.role === 'admin' || req.user.role === 'sub_admin' || 
                   (req.user.id === reportee.reportingManagerId);

  if (!isManager) throw forbidden();

  const module = await req.prisma.trainingModule.findUnique({
    where: { id: parseInt(req.body.moduleId) }
  });

  if (!module) throw notFound('Training Module');

  const completionDeadline = getCompletionDeadline(module.publishedAt);

  const assignment = await req.prisma.trainingAssignment.create({
    data: {
      moduleId: module.id,
      assignedToId: reportee.id,
      assignedById: req.user.id,
      dueDate: req.body.dueDate,
      completionDeadline,
      notes: req.body.notes
    },
    include: {
      module: { select: { id: true, title: true, completionPointsValue: true } },
      assignedTo: { select: { id: true, name: true, email: true } }
    }
  });

  res.status(201).json(assignment);
}));

// GET my assignments (for current user)
router.get('/my-assignments', asyncHandler(async (req, res) => {
  const assignments = await req.prisma.trainingAssignment.findMany({
    where: { assignedToId: req.user.id },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          duration: true,
          isMandatory: true,
          completionPointsValue: true,
          publishedAt: true,
          exams: true
        }
      },
      assignedBy: { select: { id: true, name: true } }
    },
    orderBy: { completionDeadline: 'asc' }
  });

  const enriched = assignments.map(a => ({
    ...a,
    daysUntilDeadline: a.completionDeadline 
      ? Math.ceil((new Date(a.completionDeadline) - new Date()) / (1000 * 60 * 60 * 24))
      : null,
    isOverdue: a.completionDeadline && new Date() > new Date(a.completionDeadline) && a.status !== 'completed'
  }));

  res.json(enriched);
}));

// GET my reportees' training progress (for managers)
router.get('/team-progress', asyncHandler(async (req, res) => {
  const reportees = await req.prisma.user.findMany({
    where: { reportingManagerId: req.user.id },
    select: { id: true, name: true, email: true, points: true }
  });

  const progress = [];
  for (const reportee of reportees) {
    const assignments = await req.prisma.trainingAssignment.findMany({
      where: { assignedToId: reportee.id },
      include: {
        module: { select: { title: true, isMandatory: true, completionPointsValue: true } }
      }
    });

    progress.push({
      employee: reportee,
      assignments,
      totalAssigned: assignments.length,
      completed: assignments.filter(a => a.status === 'completed').length,
      pointsEarned: assignments.reduce((sum, a) => sum + (a.pointsAwarded || 0), 0)
    });
  }

  res.json(progress);
}));

// PUT update assignment status
router.put('/assignments/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireEnum(req.body.status, ['assigned', 'in_progress', 'completed', 'not_started'], 'status');

  const assignment = await req.prisma.trainingAssignment.findUnique({
    where: { id },
    include: { module: { select: { title: true, completionPointsValue: true } } }
  });

  if (!assignment) throw notFound('Assignment');

  const isAllowed = req.user.id === assignment.assignedToId ||
                   req.user.role === 'admin' || req.user.role === 'sub_admin' ||
                   (assignment.assignedById === req.user.id);

  if (!isAllowed) throw forbidden();

  let pointsAwarded = 0;
  let completionPointsEarned = false;

  // Check if completion is within 90-day deadline
  if (req.body.status === 'completed') {
    const isOnTime = isWithinDeadline(new Date(), assignment.completionDeadline);
    if (isOnTime) {
      pointsAwarded = assignment.module.completionPointsValue || 25;
      completionPointsEarned = true;
      
      // Award points to user
      await awardPoints(
        assignment.assignedToId,
        pointsAwarded,
        `Training Completion: ${assignment.module.title} (Within 90-day deadline)`,
        req.prisma
      );
    }
  }

  const updated = await req.prisma.trainingAssignment.update({
    where: { id },
    data: {
      status: req.body.status,
      completedAt: req.body.status === 'completed' ? new Date() : null,
      pointsAwarded,
      completionPointsEarned
    },
    include: { module: { select: { title: true } } }
  });

  res.json(updated);
}));

// ═══════════════════════════════════════════════
// TRAINING CONTRIBUTIONS - Members improve modules
// ═══════════════════════════════════════════════

// POST add contribution to training module
router.post('/contribute', asyncHandler(async (req, res) => {
  requireFields(req.body, 'moduleId', 'title', 'content', 'type');
  requireEnum(req.body.type, ['addition', 'correction', 'improvement', 'resource'], 'type');

  const module = await req.prisma.trainingModule.findUnique({
    where: { id: parseInt(req.body.moduleId) }
  });

  if (!module) throw notFound('Training Module');

  const contribution = await req.prisma.trainingContribution.create({
    data: {
      moduleId: module.id,
      contributedBy: req.user.id,
      title: req.body.title,
      content: req.body.content,
      type: req.body.type
    },
    include: {
      contributor: { select: { id: true, name: true } }
    }
  });

  res.status(201).json(contribution);
}));

// GET pending contributions (for admin)
router.get('/contributions/pending', requireAdmin, asyncHandler(async (req, res) => {
  const contributions = await req.prisma.trainingContribution.findMany({
    where: { status: 'pending' },
    include: {
      module: { select: { id: true, title: true } },
      contributor: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(contributions);
}));

// GET contributions for specific module
router.get('/modules/:id/contributions', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const contributions = await req.prisma.trainingContribution.findMany({
    where: { 
      moduleId: id,
      status: { in: ['approved', 'implemented'] }
    },
    include: {
      contributor: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(contributions);
}));

// PUT approve/reject/implement contribution
router.put('/contributions/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireEnum(req.body.status, ['approved', 'rejected', 'implemented'], 'status');

  const contribution = await req.prisma.trainingContribution.findUnique({
    where: { id },
    include: { contributor: { select: { id: true, name: true } } }
  });

  if (!contribution) throw notFound('Contribution');

  let pointsAwarded = 0;

  // Award points for approved contributions
  if (req.body.status === 'approved' || req.body.status === 'implemented') {
    // Points based on contribution type
    const pointsByType = {
      'addition': 50,
      'correction': 25,
      'improvement': 40,
      'resource': 35
    };
    
    pointsAwarded = pointsByType[contribution.type] || 30;

    // Award points to contributor
    await awardPoints(
      contribution.contributedBy,
      pointsAwarded,
      `Training Value Added: "${contribution.title}" (${contribution.type}) - Approved by leader`,
      req.prisma
    );
  }

  const updated = await req.prisma.trainingContribution.update({
    where: { id },
    data: {
      status: req.body.status,
      approvedBy: req.user.id,
      approvalNotes: req.body.approvalNotes,
      pointsAwarded
    },
    include: {
      contributor: { select: { name: true } },
      module: { select: { title: true } }
    }
  });

  res.json(updated);
}));

// ═══════════════════════════════════════════════
// POINTS & REWARDS - User point tracking
// ═══════════════════════════════════════════════

// GET user's training points and rewards
router.get('/my-points', asyncHandler(async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true }
  });

  if (!user) throw notFound('User');

  // Aggregate total points from PointLog (User model has no points field)
  const agg = await req.prisma.pointLog.aggregate({
    where: { userId: req.user.id },
    _sum: { points: true }
  });
  const totalPoints = agg._sum.points || 0;

  // Get point history
  const pointHistory = await req.prisma.pointLog.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  // Get training stats
  const assignments = await req.prisma.trainingAssignment.findMany({
    where: { assignedToId: req.user.id },
    include: { module: { select: { title: true } } }
  });

  const contributions = await req.prisma.trainingContribution.findMany({
    where: { contributedBy: req.user.id }
  });

  const completionPoints = assignments
    .filter(a => a.completionPointsEarned)
    .reduce((sum, a) => sum + a.pointsAwarded, 0);

  const contributionPoints = contributions
    .filter(c => c.status === 'approved' || c.status === 'implemented')
    .reduce((sum, c) => sum + c.pointsAwarded, 0);

  res.json({
    user,
    totalPoints,
    completionPoints,
    contributionPoints,
    pointHistory,
    stats: {
      trainingsCompleted: assignments.filter(a => a.status === 'completed').length,
      trainingsAssigned: assignments.length,
      contributionsSubmitted: contributions.length,
      contributionsApproved: contributions.filter(c => c.status === 'approved' || c.status === 'implemented').length
    }
  });
}));

// GET leaderboard (top point earners)
router.get('/leaderboard', asyncHandler(async (req, res) => {
  // Aggregate points from PointLog grouped by user (User model has no points field)
  const pointAggregates = await req.prisma.pointLog.groupBy({
    by: ['userId'],
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 50
  });

  if (pointAggregates.length === 0) return res.json([]);

  // Fetch user details for top earners
  const userIds = pointAggregates.map(p => p.userId);
  const users = await req.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, department: true }
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const leaderboard = await Promise.all(pointAggregates.map(async (agg, idx) => {
    const user = userMap[agg.userId];
    if (!user) return null;

    const assignments = await req.prisma.trainingAssignment.findMany({
      where: { assignedToId: agg.userId },
      include: { module: { select: { title: true } } }
    });

    const completionPoints = assignments
      .filter(a => a.completionPointsEarned)
      .reduce((sum, a) => sum + a.pointsAwarded, 0);

    const contributions = await req.prisma.trainingContribution.findMany({
      where: {
        contributedBy: agg.userId,
        status: { in: ['approved', 'implemented'] }
      }
    });

    const contributionPoints = contributions.reduce((sum, c) => sum + c.pointsAwarded, 0);

    return {
      ...user,
      points: agg._sum.points || 0,
      rank: idx + 1,
      completionPoints,
      contributionPoints,
      trainingsCompleted: assignments.filter(a => a.status === 'completed').length
    };
  }));

  res.json(leaderboard.filter(Boolean));
}));

module.exports = router;
