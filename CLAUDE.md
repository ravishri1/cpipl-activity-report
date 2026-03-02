# CPIPL HR System — AI Conventions & Architecture Guide

> **Read this file first.** It replaces the need to scan 33,000+ lines of code.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | Node.js + Express + Prisma ORM | Port 5000, SQLite |
| Frontend | React (Vite) + Tailwind CSS | Port 3000, proxied to backend |
| Database | SQLite | `server/prisma/dev.db` |
| Schema | Prisma | `server/prisma/schema.prisma` (40 models) |

## Key Paths

```
server/src/app.js              ← Express app, all routes registered here
server/src/routes/*.js          ← 28 route files (all use asyncHandler)
server/src/middleware/auth.js    ← authenticate, requireAdmin
server/src/middleware/errorHandler.js ← Central error handler
server/src/utils/asyncHandler.js ← Wraps async handlers (eliminates try-catch)
server/src/utils/httpErrors.js   ← badRequest, notFound, forbidden, conflict
server/src/utils/validate.js     ← requireFields, requireEnum, parseId
server/src/services/cronJobs.js  ← node-cron scheduler
server/src/services/emailService.js ← Nodemailer (Gmail SMTP)
client/src/hooks/               ← useApi, useFetch, useForm
client/src/utils/formatters.js   ← formatDate, formatINR, capitalize
client/src/utils/constants.js    ← Shared color maps (status badges)
client/src/components/shared/    ← StatusBadge, LoadingSpinner, EmptyState, AlertMessage
```

## Auth Roles

| Role | Middleware | Can Do |
|------|-----------|--------|
| `admin` | `requireAdmin` | Everything |
| `team_lead` | `requireAdmin` | Same as admin for most routes |
| `member` | `authenticate` | Own profile, own reports, own leave/expenses/tickets |

## Backend Route Template (ALWAYS follow this pattern)

```js
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate); // All routes need auth

// Admin-only route
router.get('/admin-thing', requireAdmin, asyncHandler(async (req, res) => {
  const items = await req.prisma.model.findMany();
  res.json(items);
}));

// Self-or-admin route
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const item = await req.prisma.model.findUnique({ where: { id } });
  if (!item) throw notFound('Item');
  if (req.user.role !== 'admin' && req.user.id !== item.userId) throw forbidden();
  res.json(item);
}));

// Create with validation
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type');
  requireEnum(req.body.type, ['a', 'b', 'c'], 'type');
  const item = await req.prisma.model.create({ data: req.body });
  res.status(201).json(item);
}));

module.exports = router;
```

### Backend Rules

- **ALWAYS** wrap handlers with `asyncHandler()` — never write try-catch in routes
- **ALWAYS** use `requireAdmin` middleware for admin-only routes (not inline checks)
- **ALWAYS** use `throw notFound('Thing')` — never `return res.status(404).json(...)`
- **ALWAYS** use `parseId()` for URL params — it throws 400 if invalid
- **ALWAYS** use `requireFields()` and `requireEnum()` for input validation
- **NEVER** duplicate `isAdmin()` function — use `requireAdmin` or inline `req.user.role === 'admin'`
- **NEVER** catch Prisma P2002/P2025 in routes — errorHandler handles them centrally
- Prisma is at `req.prisma` (attached by middleware)
- Dates stored as strings: `"2026-03-02"` format

### Error Handler (automatic — no route code needed)

| Error | HTTP Status | When |
|-------|-------------|------|
| `throw badRequest('msg')` | 400 | Validation failure |
| `throw forbidden()` | 403 | Access denied |
| `throw notFound('Thing')` | 404 | Record not found |
| `throw conflict('msg')` | 409 | Duplicate/conflict |
| Prisma P2002 | 409 | Unique constraint violation |
| Prisma P2025 | 404 | Record not found in update/delete |
| Prisma P2003 | 400 | Foreign key constraint |
| Unknown error | 500 | Logged to console |

## API Route Map (all prefixed `/api/`)

| Path | File | Key Features |
|------|------|-------------|
| `/auth` | auth.js | Login, register, change password |
| `/users` | users.js | Profile, directory, org-chart, documents, education, family, employment, audit trail |
| `/reports` | reports.js | Daily activity reports |
| `/dashboard` | dashboard.js | Summary stats |
| `/settings` | settings.js | App settings |
| `/google` | google.js | Google OAuth integration |
| `/points` | points.js | Leaderboard, thumbs-up, appreciation |
| `/attendance` | attendance.js | Clock in/out, team attendance |
| `/leave` | leave.js | Leave requests, balances, approvals |
| `/holidays` | holidays.js | Holiday calendar CRUD |
| `/import` | import.js | CSV/greytHR bulk import |
| `/companies` | companies.js | Multi-company management |
| `/extraction` | extraction.js | Resume/document extraction |
| `/policies` | policies.js | Policy CRUD, versions, acceptance tracking |
| `/payroll` | payroll.js | Salary structures, payslips, revisions |
| `/expenses` | expenses.js | Expense claims, approvals, bulk ops |
| `/announcements` | announcements.js | Company announcements |
| `/letters` | letters.js | Letter templates, generation |
| `/assets` | assets.js | Asset management, handovers, warranty |
| `/lifecycle` | lifecycle.js | Onboarding checklists, separation/FnF |
| `/overtime` | overtime.js | Overtime requests, approvals |
| `/analytics` | analytics.js | HR analytics, headcount, attrition |
| `/surveys` | surveys.js | Employee surveys |
| `/tickets` | tickets.js | Helpdesk with SLA tracking |
| `/otp` | otp.js | OTP verification |
| `/wiki` | wiki.js | Knowledge base articles |
| `/suggestions` | suggestions.js | Employee suggestions |
| `/training` | training.js | Training modules, exams, attempts |

## Frontend Component Template (ALWAYS follow this pattern)

```jsx
import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR, capitalize } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { LEAVE_STATUS_STYLES } from '../../utils/constants';

export default function MyComponent() {
  const { data: items, loading, error, refetch } = useFetch('/api/items/my', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (items.length === 0) return <EmptyState icon="📋" title="No items" subtitle="Nothing here yet" />;

  return (
    <div className="p-6">
      {success && <AlertMessage type="success" message={success} />}
      {items.map(item => (
        <div key={item.id}>
          <StatusBadge status={item.status} styles={LEAVE_STATUS_STYLES} />
          <span>{formatDate(item.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
```

### Frontend Rules

- **ALWAYS** use `useFetch()` for GET-on-mount — never manual useState+useEffect
- **ALWAYS** use `useApi()` for mutations (POST/PUT/DELETE)
- **ALWAYS** use `<LoadingSpinner />` — never inline spinner divs
- **ALWAYS** use `<AlertMessage />` — never inline error/success banners
- **ALWAYS** use `<StatusBadge />` with constants — never duplicate color maps
- **ALWAYS** use `formatDate()` / `formatINR()` from formatters — never local copies
- **ALWAYS** import from `../../utils/constants` for status color maps
- API base: `api.get('/api/...')` via axios instance in `services/api.js`

## Shared Hooks Reference

```js
// useFetch — auto-fetches on mount, returns data
const { data, loading, error, refetch } = useFetch('/api/path', defaultValue);

// useApi — for button-triggered actions
const { data, loading, error, success, execute, clearMessages } = useApi(defaultValue);
await execute(() => api.post('/api/path', body), 'Created!');

// useForm — form state management
const { form, setField, reset, submitting, handleSubmit } = useForm({ name: '', type: '' });
handleSubmit(async () => { await api.post('/api/path', form); });
```

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| API URLs | kebab-case | `/api/leave/my-balance` |
| Route files | camelCase.js | `lifecycle.js` |
| React components | PascalCase.jsx | `AssetManager.jsx` |
| Hooks | camelCase.js | `useApi.js` |
| DB fields | camelCase | `dateOfJoining` |
| Enum values | snake_case | `full_time`, `notice_period` |

## Database Models (40 total)

**Core:** User, Company, Setting
**Reports:** DailyReport, ReportTask, Reminder
**HR:** Attendance, LeaveType, LeaveBalance, LeaveRequest, Holiday
**Employee Profile:** Education, FamilyMember, PreviousEmployment, EmployeeDocument, ProfileChangeLog
**Payroll:** SalaryStructure, Payslip, SalaryRevision
**Finance:** ExpenseClaim, ExpenseApprovalLog
**Communication:** Announcement, LetterTemplate, GeneratedLetter
**Assets:** Asset, AssetHandover
**Lifecycle:** OnboardingChecklist, Separation
**Engagement:** Survey, SurveyResponse, Ticket, TicketComment
**Misc:** GoogleToken, EmailActivity, ChatActivity, PointLog, ThumbsUp, Appreciation, AppreciationBudget, ShiftDefinition, OvertimeRequest, OtpVerification, WikiArticle, Suggestion, TrainingModule, TrainingExam, TrainingAttempt, Policy, PolicySection, PolicyAcceptance, PolicyVersion

## Crash Recovery

All code is git-tracked. After any major work:
```bash
cd "D:\Activity Report Software"
git add -A && git commit -m "description"
```
Recovery: clone from git, run `npm install` in both `server/` and `client/`, then `npx prisma generate`.
