# CPIPL HR System — AI Conventions & Architecture Guide

> **Read this file first.** It replaces the need to scan 33,000+ lines of code.

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | Node.js + Express + Prisma ORM | Port 5000 |
| Frontend | React (Vite) + Tailwind CSS | Port 3000, proxied to backend |
| Database | PostgreSQL (Neon) | Connection via `DATABASE_URL` env var |
| File Storage | Google Drive API | Service account with domain-wide delegation |
| Schema | Prisma | `server/prisma/schema.prisma` (70+ models) |
| Deployment | Vercel (serverless) | Auto-deploy from GitHub `main` branch |
| CI/CD | GitHub Actions | Backend, frontend, and production workflows |

## Key Paths

```
server/src/app.js              ← Express app, all routes registered here
server/src/routes/*.js          ← 30+ route files (all use asyncHandler)
server/src/routes/files.js      ← File upload/download (Google Drive)
server/src/middleware/auth.js    ← authenticate, requireAdmin
server/src/middleware/errorHandler.js ← Central error handler
server/src/utils/asyncHandler.js ← Wraps async handlers (eliminates try-catch)
server/src/utils/httpErrors.js   ← badRequest, notFound, forbidden, conflict
server/src/utils/validate.js     ← requireFields, requireEnum, parseId
server/src/services/cronJobs.js  ← node-cron scheduler
server/src/services/emailService.js ← Nodemailer (Gmail SMTP)
server/src/services/google/     ← Google Drive, Calendar, Chat, Workspace integrations
api/index.js                    ← Vercel serverless entry point (wraps Express)
vercel.json                     ← Vercel build/deploy config, rewrites, security headers
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

## Database Models (70+ total)

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

## Mandatory Completion Checklist (NEVER skip)

Before telling the user "done" or "complete", **verify EVERY item**:

### For ANY feature that has a Save/Edit/Delete button:
1. **Endpoint exists** — The exact API path used in frontend (`api.put('/api/xyz/:id')`) has a matching `router.put('/:id')` in the backend route file
2. **Route registered** — The route file is imported and mounted in `server/src/app.js` (`app.use('/api/xyz', xyzRoutes)`)
3. **Payload matches** — Fields sent from frontend form match what backend reads from `req.body`
4. **Prisma model fields exist** — Every field in `req.body` exists in the Prisma schema model
5. **refetch() called** — After every successful `execute()`, call `refetch()` to reload the list/data
6. **Modal closes** — After save, reset form state AND close the modal/form
7. **Error shown** — `{saveErr && <AlertMessage type="error" message={saveErr} />}` is in JSX

### The #1 Bug Pattern (fix EVERY time):
```jsx
// WRONG — shows success but data doesn't refresh
const handleSave = async () => {
  await execute(() => api.put(`/api/items/${id}`, form), 'Updated!');
};

// CORRECT — data refreshes after save
const handleSave = async () => {
  await execute(() => api.put(`/api/items/${id}`, form), 'Updated!');
  refetch();          // ← RELOAD data
  setEditing(null);   // ← CLOSE modal
  reset();            // ← RESET form
};
```

### For ANY new Prisma model/field:
1. Added to `schema.prisma`
2. Run `npx prisma db push` or create migration
3. Verify with `npx prisma studio`

## Token Optimization Rules (for AI assistants)

### DO:
- **Read CLAUDE.md first** — it has all patterns, don't explore files
- **Ask for the FULL requirement upfront** — don't accept incremental "also add X" messages
- **Build backend + frontend + schema together** in ONE response
- **Copy existing patterns exactly** — don't reinvent
- **Use the scaffold script** at `scripts/scaffold.js` for new CRUD features

### DON'T:
- Don't explore files to "understand the codebase" — CLAUDE.md has everything
- Don't read more than 2-3 files per feature — patterns are documented above
- Don't ask clarifying questions unless truly ambiguous — follow existing patterns
- Don't write code in multiple rounds — deliver complete working code in ONE pass
- Don't refactor existing code unless explicitly asked

### When User Says "add X feature":
1. Check if similar feature exists in the route map above
2. Read ONLY that similar route file + component (2 files max)
3. Copy the pattern, change names/fields
4. Deliver: schema change + route file + component + app.js registration — ALL at once
5. Run completion checklist above
6. Run `node scripts/audit.js` to verify no broken connections

## Automated Testing

```bash
# Run after EVERY feature change — finds broken buttons, missing routes, missing refetch
node scripts/audit.js
```

This checks:
- Every `api.get/post/put/delete()` in frontend has a matching backend route
- Every `execute()` call is followed by `refetch()`
- Every `useApi()` error is displayed in JSX
- No manual useState+useEffect where useFetch should be used

**Rule: Zero HIGH severity warnings allowed. Fix before marking done.**

## Deployment Architecture

```
GitHub (main branch)
  └→ Push triggers Vercel auto-deploy
      ├→ Install: cd server && npm install && npx prisma generate && npx prisma db push
      ├→ Build:   cd client && npm install && npx vite build
      ├→ Output:  client/dist (static SPA)
      └→ Rewrites: /api/* → serverless function (api/index.js wraps Express)

Database:  Neon PostgreSQL (pooled + direct connections)
Storage:   Google Drive (service account at me@colorpapers.in workspace)
Email:     Gmail SMTP via Nodemailer
Scheduler: node-cron (runs on backend process)
```

**Production URLs:**
| Purpose | URL |
|---------|-----|
| Production App | `https://eod.colorpapers.in` |
| Vercel Dashboard | `https://cpipl-activity-report.vercel.app` |
| GitHub Repo | `https://github.com/ravishri1/cpipl-activity-report.git` |
| Neon DB | `ep-shiny-meadow-ai9ssvlk-pooler.c-4.us-east-1.aws.neon.tech/neondb` |
| Google Workspace | `me@colorpapers.in` (domain: `colorpapers.in`) |

**Auth:** Clerk SSO — no password-based login for production accounts.
- Admin: `me@colorpapers.in` (Ravi Pardeep Shrivastav, user id: 1)
- Vercel deployment URLs have SSO protection — always use `eod.colorpapers.in` for API calls

**File Storage:** All uploads go to Google Drive via `server/src/services/google/googleDrive.js`.
- Folder structure: `CPIPL HR Files / {EmployeeName} ({EmployeeId}) / ...`
- Profile photos stored as direct Drive URLs in `User.driveProfilePhotoUrl`
- File metadata tracked in `DriveFile` model
- No local disk storage — all files in Google Drive

**Important Notes:**
- All date fields are `String` type in Prisma (NOT DateTime) — `startsWith:` queries work fine on PostgreSQL
- `vercel.json` install command auto-runs `npx prisma db push` on every deploy
- Profile photos go to Google Drive (NOT base64 in database)

## Crash Recovery

All code is git-tracked. After any major work:
```bash
cd "D:\Activity Report Software"
git add -A && git commit -m "description"
git push origin main  # auto-deploys to Vercel
```
Recovery: clone from git, run `npm install` in both `server/` and `client/`, then `npx prisma generate`.
Schema sync: `cd server && npx prisma db push` (pushes schema to Neon PostgreSQL).
