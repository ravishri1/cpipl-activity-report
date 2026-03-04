# Training Module System - Complete Implementation Guide

## Overview
Enhanced collaborative training system with:
- ✅ General training modules (visible to all)
- ✅ Department-specific training modules
- ✅ Manager assignment to reportees
- ✅ Employee contributions to modules (make them better)
- ✅ Tracking and progress monitoring

---

## Part 1: Database Schema Updates

### Step 1: Add New Prisma Models

Add these models to `server/prisma/schema.prisma` **BEFORE the ExpenseApprovalLog section** (around line 1092):

```prisma
// ─── Training Assignment (Manager assigns to reportees) ───
model TrainingAssignment {
  id              Int       @id @default(autoincrement())
  moduleId        Int
  assignedToId    Int                                       // Employee being assigned
  assignedById    Int                                       // Manager/Admin who assigned
  dueDate         String?                                   // YYYY-MM-DD format
  status          String    @default("assigned")           // assigned, in_progress, completed, not_started
  completedAt     DateTime?
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  module          TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  assignedTo      User      @relation("TrainingAssignmentsReceived", fields: [assignedToId], references: [id])
  assignedBy      User      @relation("TrainingAssignmentsGiven", fields: [assignedById], references: [id])

  @@unique([moduleId, assignedToId])
  @@index([moduleId])
  @@index([assignedToId])
  @@index([status])
  @@index([dueDate])
}

// ─── Training Contribution (Members add content to modules) ───
model TrainingContribution {
  id              Int       @id @default(autoincrement())
  moduleId        Int
  contributedBy   Int                                       // User who contributed
  title           String                                    // "Added AI Use Cases", "Fixed typo in section 3"
  content         String                                   // markdown - what they're adding/suggesting
  type            String    @default("addition")           // addition, correction, improvement, resource
  status          String    @default("pending")            // pending, approved, rejected, implemented
  approvedBy      Int?                                      // Admin/creator who approved
  approvalNotes   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  module          TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  contributor     User      @relation("TrainingContributions", fields: [contributedBy], references: [id])
  approver        User?     @relation("ContributionApprovals", fields: [approvedBy], references: [id])

  @@index([moduleId])
  @@index([contributedBy])
  @@index([status])
  @@index([type])
}
```

### Step 2: Update Existing Models

**A) Update TrainingModule model** - Change to include new relationships:

Replace the entire `TrainingModule` model section with:

```prisma
model TrainingModule {
  id              Int       @id @default(autoincrement())
  title           String
  description     String?
  category        String    @default("general")            // general, compliance, technical, soft_skills, ai, onboarding
  content         String                                   // markdown/html training material
  duration        Int?                                     // estimated minutes
  passingScore    Int       @default(70)                   // % to pass exam
  isActive        Boolean   @default(true)
  isMandatory     Boolean   @default(false)
  scope           String    @default("general")            // general, department
  departmentId    Int?                                     // if scope=department, which department
  createdBy       Int                                      // User ID who created
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  creator         User      @relation("TrainingModulesCreated", fields: [createdBy], references: [id])
  department      Department? @relation(fields: [departmentId], references: [id])
  exams           TrainingExam[]
  attempts        TrainingAttempt[]
  assignments     TrainingAssignment[]
  contributions   TrainingContribution[]

  @@index([category])
  @@index([isActive])
  @@index([scope])
  @@index([departmentId])
  @@index([createdBy])
}
```

**B) Update User model** - Add training-related relationships:

Find the User model and add these relationships:

```prisma
model User {
  // ... existing fields ...

  // Training relationships
  trainingModulesCreated    TrainingModule[]              @relation("TrainingModulesCreated")
  trainingAssignmentsGiven  TrainingAssignment[]          @relation("TrainingAssignmentsGiven")
  trainingAssignmentsReceived TrainingAssignment[]        @relation("TrainingAssignmentsReceived")
  trainingContributions     TrainingContribution[]        @relation("TrainingContributions")
  contributionApprovals     TrainingContribution[]        @relation("ContributionApprovals")
  
  // ... rest of model ...
}
```

**C) Update Department model** - Add relationship:

```prisma
model Department {
  // ... existing fields ...
  trainingModules   TrainingModule[]
  // ... rest of model ...
}
```

### Step 3: Run Migration

```bash
cd server
npx prisma migrate dev --name "add_training_assignments_contributions"
```

---

## Part 2: Backend Routes & API Endpoints

### Create `server/src/routes/training.js`

```javascript
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate); // All routes need auth

// ═══════════════════════════════════════════════
// TRAINING MODULES - Browse & View
// ═══════════════════════════════════════════════

// GET all training modules (general + user's department)
router.get('/modules', asyncHandler(async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    include: { department: true }
  });

  const modules = await req.prisma.trainingModule.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: 'general' },
        { scope: 'department', departmentId: user.departmentId }
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

  res.json(modules);
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
        where: { status: 'approved' },
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
  res.json(module);
}));

// ═══════════════════════════════════════════════
// TRAINING MODULES - Admin CRUD
// ═══════════════════════════════════════════════

// POST create training module
router.post('/modules', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'content', 'category');
  requireEnum(req.body.scope || 'general', ['general', 'department'], 'scope');

  if (req.body.scope === 'department') {
    requireFields(req.body, 'departmentId');
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
      departmentId: req.body.departmentId,
      createdBy: req.user.id
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
      isActive: req.body.isActive !== undefined ? req.body.isActive : module.isActive
    },
    include: { creator: { select: { id: true, name: true } } }
  });

  res.json(updated);
}));

// ═══════════════════════════════════════════════
// TRAINING ASSIGNMENTS - Manager assigns to reportees
// ═══════════════════════════════════════════════

// POST assign training to reportee
router.post('/assign', asyncHandler(async (req, res) => {
  requireFields(req.body, 'moduleId', 'assignedToId');

  // Verify user is the assignedTo's manager
  const reportee = await req.prisma.user.findUnique({
    where: { id: parseInt(req.body.assignedToId) }
  });

  if (!reportee) throw notFound('Employee');

  // Check if requester is manager/admin
  const isManager = req.user.role === 'admin' || 
                   (req.user.id === reportee.managerId);

  if (!isManager) throw forbidden();

  // Check if module exists
  const module = await req.prisma.trainingModule.findUnique({
    where: { id: parseInt(req.body.moduleId) }
  });

  if (!module) throw notFound('Training Module');

  // Create assignment
  const assignment = await req.prisma.trainingAssignment.create({
    data: {
      moduleId: module.id,
      assignedToId: reportee.id,
      assignedById: req.user.id,
      dueDate: req.body.dueDate,
      notes: req.body.notes
    },
    include: {
      module: { select: { id: true, title: true } },
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
          exams: true
        }
      },
      assignedBy: { select: { id: true, name: true } }
    },
    orderBy: { dueDate: 'asc' }
  });

  res.json(assignments);
}));

// GET my reportees' training progress (for managers)
router.get('/team-progress', asyncHandler(async (req, res) => {
  // Get all direct reportees
  const reportees = await req.prisma.user.findMany({
    where: { managerId: req.user.id },
    select: { id: true, name: true, email: true }
  });

  const progress = [];
  for (const reportee of reportees) {
    const assignments = await req.prisma.trainingAssignment.findMany({
      where: { assignedToId: reportee.id },
      include: {
        module: { select: { title: true, isMandatory: true } }
      }
    });

    progress.push({
      employee: reportee,
      assignments,
      totalAssigned: assignments.length,
      completed: assignments.filter(a => a.status === 'completed').length
    });
  }

  res.json(progress);
}));

// PUT update assignment status
router.put('/assignments/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireEnum(req.body.status, ['assigned', 'in_progress', 'completed', 'not_started'], 'status');

  const assignment = await req.prisma.trainingAssignment.findUnique({
    where: { id }
  });

  if (!assignment) throw notFound('Assignment');

  // Only assignee or their manager can update
  const isAllowed = req.user.id === assignment.assignedToId ||
                   req.user.role === 'admin' ||
                   (assignment.assignedById === req.user.id);

  if (!isAllowed) throw forbidden();

  const updated = await req.prisma.trainingAssignment.update({
    where: { id },
    data: {
      status: req.body.status,
      completedAt: req.body.status === 'completed' ? new Date() : null
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

// GET pending contributions (for module creator/admin)
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

// PUT approve/reject contribution
router.put('/contributions/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireEnum(req.body.status, ['approved', 'rejected', 'implemented'], 'status');

  const contribution = await req.prisma.trainingContribution.findUnique({
    where: { id }
  });

  if (!contribution) throw notFound('Contribution');

  const updated = await req.prisma.trainingContribution.update({
    where: { id },
    data: {
      status: req.body.status,
      approvedBy: req.user.id,
      approvalNotes: req.body.approvalNotes
    },
    include: {
      contributor: { select: { name: true } },
      module: { select: { title: true } }
    }
  });

  res.json(updated);
}));

module.exports = router;
```

### Register Training Routes in `server/src/app.js`

Add this line with other route registrations (around line 60):

```javascript
const trainingRoutes = require('./routes/training');
app.use('/api/training', trainingRoutes);
```

---

## Part 3: Frontend Components

### 1. Create `client/src/components/training/TrainingLibrary.jsx` (350 lines)

```jsx
import { useState } from 'react';
import { BookOpen, Filter, Plus, Users } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate, capitalize } from '../../utils/formatters';

const CATEGORY_COLORS = {
  general: 'bg-blue-50 border-blue-200 text-blue-700',
  compliance: 'bg-red-50 border-red-200 text-red-700',
  technical: 'bg-purple-50 border-purple-200 text-purple-700',
  soft_skills: 'bg-green-50 border-green-200 text-green-700',
  ai: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  onboarding: 'bg-yellow-50 border-yellow-200 text-yellow-700'
};

const SCOPE_STYLES = {
  general: 'bg-blue-100 text-blue-800',
  department: 'bg-purple-100 text-purple-800'
};

export default function TrainingLibrary() {
  const { data: modules, loading, error, refetch } = useFetch('/api/training/modules', []);
  const { execute: assignTraining, loading: assigning } = useApi();
  const [selectedModule, setSelectedModule] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const filteredModules = filterCategory
    ? modules.filter(m => m.category === filterCategory)
    : modules;

  const categories = [...new Set(modules.map(m => m.category))];

  const handleAssignToMe = async (moduleId) => {
    await assignTraining(
      () => api.post('/api/training/assign', {
        moduleId,
        assignedToId: localStorage.getItem('userId')
      }),
      'Assigned to you!'
    );
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Training Library</h1>
          <p className="text-gray-600 mt-1">Develop your skills with our training modules</p>
        </div>
        <BookOpen className="w-12 h-12 text-blue-600" />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-5 h-5 text-gray-600" />
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${
            filterCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All ({modules.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filterCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {capitalize(cat.replace(/_/g, ' '))}
          </button>
        ))}
      </div>

      {/* Training Grid */}
      {filteredModules.length === 0 ? (
        <EmptyState 
          icon="📚" 
          title="No training modules" 
          subtitle="Check back soon for new training content"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(module => (
            <div
              key={module.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedModule(module)}
            >
              {/* Category Badge */}
              <div className="flex gap-2 mb-3">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                    CATEGORY_COLORS[module.category]
                  }`}
                >
                  {capitalize(module.category.replace(/_/g, ' '))}
                </span>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${SCOPE_STYLES[module.scope]}`}>
                  {capitalize(module.scope)}
                </span>
                {module.isMandatory && (
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                    Mandatory
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{module.title}</h3>

              {/* Description */}
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{module.description}</p>

              {/* Metadata */}
              <div className="text-xs text-gray-500 mb-3 space-y-1">
                <p>⏱️ {module.duration ? `${module.duration} min` : 'Self-paced'}</p>
                <p>👤 By: {module.creator.name}</p>
                <p className="flex gap-2">
                  <Users className="w-3 h-3" /> {module._count.assignments} assigned
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAssignToMe(module.id);
                }}
                disabled={assigning}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
              >
                {assigning ? 'Assigning...' : 'Assign to Me'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Module Detail Modal */}
      {selectedModule && (
        <TrainingDetailModal
          module={selectedModule}
          onClose={() => setSelectedModule(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

// Separate modal component for module details
function TrainingDetailModal({ module, onClose, onRefresh }) {
  const { data: contributions } = useFetch(`/api/training/modules/${module.id}/contributions`, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{module.title}</h2>
            <p className="text-gray-600 mt-1">{module.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Module Content */}
        <div className="p-6">
          <div
            className="prose max-w-none text-gray-700 mb-6"
            dangerouslySetInnerHTML={{ __html: module.content }}
          />

          {/* Contributions Section */}
          {contributions && contributions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Community Contributions ({contributions.length})
              </h3>
              <div className="space-y-3">
                {contributions.map(contrib => (
                  <div key={contrib.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{contrib.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{contrib.content}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        contrib.status === 'implemented'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {capitalize(contrib.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      By {contrib.contributor.name} • {formatDate(contrib.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="p-6 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-900 py-2 rounded hover:bg-gray-300 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Create `client/src/components/training/MyTrainingAssignments.jsx` (300 lines)

```jsx
import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, BookMarked } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate, capitalize } from '../../utils/formatters';

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-800 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  assigned: 'bg-yellow-100 text-yellow-800 border-yellow-300'
};

const STATUS_ICONS = {
  not_started: <Clock className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  assigned: <AlertCircle className="w-4 h-4" />
};

export default function MyTrainingAssignments() {
  const { data: assignments, loading, error, refetch } = useFetch('/api/training/my-assignments', []);
  const { execute: updateStatus, loading: updating } = useApi();
  const [expandedId, setExpandedId] = useState(null);

  const handleStatusChange = async (assignmentId, newStatus) => {
    await updateStatus(
      () => api.put(`/api/training/assignments/${assignmentId}`, { status: newStatus }),
      'Status updated!'
    );
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  const grouped = {
    not_started: assignments.filter(a => a.status === 'not_started' || a.status === 'assigned'),
    in_progress: assignments.filter(a => a.status === 'in_progress'),
    completed: assignments.filter(a => a.status === 'completed')
  };

  const mandatoryCount = assignments.filter(a => a.module.isMandatory).length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Trainings</h1>
          <p className="text-gray-600 mt-1">Track your assigned training modules</p>
        </div>
        <BookMarked className="w-12 h-12 text-blue-600" />
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Total Assigned</p>
          <p className="text-3xl font-bold text-gray-900">{assignments.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Mandatory</p>
          <p className="text-3xl font-bold text-red-600">{mandatoryCount}</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No training assigned"
          subtitle="Your assigned trainings will appear here"
        />
      ) : (
        <div className="space-y-4">
          {/* Not Started */}
          {grouped.not_started.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Not Started</h2>
              {grouped.not_started.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}

          {/* In Progress */}
          {grouped.in_progress.length > 0 && (
            <div className="space-y-2 mt-6">
              <h2 className="text-lg font-semibold text-gray-900">In Progress</h2>
              {grouped.in_progress.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {grouped.completed.length > 0 && (
            <div className="space-y-2 mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Completed ✓</h2>
              {grouped.completed.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrainingAssignmentCard({
  assignment,
  onStatusChange,
  isExpanded,
  onToggleExpand
}) {
  const isDueToday = assignment.dueDate === new Date().toISOString().split('T')[0];
  const isOverdue = assignment.dueDate < new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
      <div
        className="p-4 cursor-pointer flex justify-between items-start"
        onClick={onToggleExpand}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded border ${STATUS_COLORS[assignment.status]} flex items-center gap-1`}>
              {STATUS_ICONS[assignment.status]}
              <span className="text-sm font-medium capitalize">{assignment.status.replace(/_/g, ' ')}</span>
            </div>
            {assignment.module.isMandatory && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">MANDATORY</span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-2">{assignment.module.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{assignment.module.description}</p>

          <div className="flex gap-4 mt-3 text-sm text-gray-600">
            <span>⏱️ {assignment.module.duration ? `${assignment.module.duration} min` : 'Self-paced'}</span>
            {assignment.dueDate && (
              <span className={isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-yellow-600 font-medium' : ''}>
                📅 Due: {formatDate(assignment.dueDate)}
              </span>
            )}
            <span>👨‍🏫 Assigned by: {assignment.assignedBy.name}</span>
          </div>
        </div>

        <button className="text-gray-400 hover:text-gray-600">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
          {assignment.notes && (
            <div>
              <p className="text-sm font-medium text-gray-900">Manager Notes:</p>
              <p className="text-sm text-gray-700 mt-1">{assignment.notes}</p>
            </div>
          )}

          <div className="flex gap-2">
            {assignment.status !== 'completed' && (
              <>
                {assignment.status === 'not_started' && (
                  <button
                    onClick={() => onStatusChange(assignment.id, 'in_progress')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Start Now
                  </button>
                )}
                {assignment.status === 'in_progress' && (
                  <button
                    onClick={() => onStatusChange(assignment.id, 'completed')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium"
                  >
                    Mark Complete
                  </button>
                )}
              </>
            )}

            {assignment.module.exams && assignment.module.exams.length > 0 && (
              <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm font-medium">
                Take Exam
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Create `client/src/components/training/ContributeToModule.jsx` (200 lines)

```jsx
import { useState } from 'react';
import { Send, Lightbulb } from 'lucide-react';
import api from '../../services/api';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';

const CONTRIBUTION_TYPES = {
  addition: 'Add new content or examples',
  correction: 'Fix errors or inaccuracies',
  improvement: 'Suggest improvements to existing content',
  resource: 'Add helpful external resources'
};

export default function ContributeToModule({ moduleId, onContributionAdded }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('improvement');
  const [showForm, setShowForm] = useState(false);
  const { execute, loading, error, success } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('Please fill in all fields');
      return;
    }

    await execute(
      () => api.post('/api/training/contribute', {
        moduleId,
        title,
        content,
        type
      }),
      'Contribution submitted! Admins will review it soon.'
    );

    if (!error) {
      setTitle('');
      setContent('');
      setType('improvement');
      setShowForm(false);
      onContributionAdded?.();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
      >
        <Lightbulb className="w-5 h-5" />
        {showForm ? 'Cancel' : 'Contribute to This Module'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Type of Contribution
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CONTRIBUTION_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Added AI use cases for healthcare"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Your Contribution (Markdown supported)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your contribution..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Submitting...' : 'Submit Contribution'}
          </button>
        </form>
      )}
    </div>
  );
}
```

### 4. Create `client/src/components/training/TrainingManager.jsx` (280 lines)

For managers/admins to assign trainings to reportees - will add in next section.

---

## Part 4: Navigation & Routing

### Update `client/src/components/layout/Sidebar.jsx`

Add this to the training section (around line 200):

```jsx
{
  to: '/training/library',
  label: 'Training Library',
  icon: <BookOpen className="w-5 h-5" />,
  roles: ['admin', 'team_lead', 'member'],
  section: 'Learning'
},
{
  to: '/training/my-assignments',
  label: 'My Trainings',
  icon: <BookMarked className="w-5 h-5" />,
  roles: ['admin', 'team_lead', 'member'],
  section: 'Learning'
},
{
  to: '/training/manage',
  label: 'Training Manager',
  icon: <Users className="w-5 h-5" />,
  roles: ['admin', 'team_lead'],
  section: 'Management'
}
```

### Update `client/src/App.jsx`

Add these routes (around line 130):

```jsx
const TrainingLibrary = lazy(() => import('./components/training/TrainingLibrary'));
const MyTrainingAssignments = lazy(() => import('./components/training/MyTrainingAssignments'));
const TrainingManager = lazy(() => import('./components/training/TrainingManager'));

// In the routes section:
<Route path="/training/library" element={<SeparatedRoute><TrainingLibrary /></SeparatedRoute>} />
<Route path="/training/my-assignments" element={<SeparatedRoute><MyTrainingAssignments /></SeparatedRoute>} />
<Route path="/training/manage" element={<SeparatedRoute><RequireAdmin><TrainingManager /></RequireAdmin></SeparatedRoute>} />
```

---

## Part 5: Implementation Steps

1. **Database Schema:**
   - Add new models to schema.prisma
   - Update TrainingModule, User, Department models
   - Run migration: `npx prisma migrate dev`

2. **Backend Routes:**
   - Create `server/src/routes/training.js` with all 11 endpoints
   - Register routes in `server/src/app.js`
   - Test endpoints with Postman/curl

3. **Frontend Components:**
   - Create TrainingLibrary.jsx (browse all modules)
   - Create MyTrainingAssignments.jsx (track progress)
   - Create ContributeToModule.jsx (add suggestions)
   - Create TrainingManager.jsx (assign to reportees)

4. **Navigation:**
   - Add routes to Sidebar.jsx
   - Add routes to App.jsx
   - Test navigation

5. **Testing:**
   - Create a training module (admin)
   - Assign to a reportee (manager)
   - Contribute improvements (member)
   - Approve contributions (admin)

---

## Key Features Summary

✅ **General & Department Training** - Scope-based visibility
✅ **Manager Assignment** - Direct assignment to reportees with due dates
✅ **Employee Contributions** - Add improvements, corrections, resources
✅ **Approval Workflow** - Admin reviews and implements contributions
✅ **Progress Tracking** - Dashboard showing completion status
✅ **Mandatory Modules** - Track high-priority trainings
✅ **Community-Driven** - Make trainings better with team input

---

## Testing Checklist

- [ ] Admin can create general + department-specific modules
- [ ] Modules visible to correct users (general to all, department to their dept)
- [ ] Manager can assign training to direct reportees
- [ ] Employee sees assigned trainings with due date
- [ ] Employee can contribute improvements
- [ ] Admin can approve/reject/implement contributions
- [ ] Approved contributions display on module page
- [ ] Progress dashboard shows completion rates
- [ ] Mandatory trainings highlighted
- [ ] Notifications sent on assignment

