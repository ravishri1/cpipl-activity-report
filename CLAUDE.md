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

**Structured Logging:** Every error is logged with:
- Timestamp, level (ERROR for 500+, WARN for 4xx), HTTP method, URL, userId
- Request body for mutating requests (sensitive fields auto-redacted: password, token, aadhaar, PAN, bank details)
- Prisma error code when applicable
- Full stack trace only for 500 errors

## API Route Map (all prefixed `/api/`)

| Path | File | Key Features |
|------|------|-------------|
| `/auth` | auth.js | Login, register, change password |
| `/users` | users.js | Profile, directory, org-chart, documents, education, family, employment, audit trail |
| `/reports` | reports.js | Daily activity reports |
| `/dashboard` | dashboard.js | Summary stats |
| `/settings` | settings.js | App settings |
| `/google` | google.js | Google OAuth, auto-tasks (calendar+tasks+email), push-to-tasks, mark-handled |
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
| `/suggestions` | suggestions.js | Employee suggestions, automation insights (analyze-automation, automation-insights, automation-stats) |


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
  const { data: items, loading, error: fetchErr, refetch } = useFetch('/api/items/my', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  // ⚠️ CRITICAL: execute() THROWS on error — ALWAYS use try-catch
  const handleSave = async (form) => {
    try {
      await execute(() => api.post('/api/items', form), 'Created!');
      refetch();              // ← only runs on success
      setShowForm(false);     // ← only runs on success
    } catch {
      // Error already displayed by useApi hook
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return; // ← ALWAYS confirm deletes
    try {
      await execute(() => api.delete(`/api/items/${id}`), 'Deleted!');
      refetch();
    } catch {
      // Error already displayed by useApi hook
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      {/* ⚠️ Display ALL error sources */}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {items.length === 0 ? (
        <EmptyState icon="📋" title="No items" subtitle="Nothing here yet" />
      ) : (
        items.map(item => (
          <div key={item.id}>
            <StatusBadge status={item.status} styles={LEAVE_STATUS_STYLES} />
            <span>{formatDate(item.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}
```

### Frontend Rules

- **ALWAYS** use `useFetch()` for GET-on-mount — never manual useState+useEffect
- **ALWAYS** use `useApi()` for mutations (POST/PUT/DELETE)
- **ALWAYS** wrap `await execute()` in try-catch — execute THROWS on error
- **ALWAYS** put refetch/close/reset INSIDE the try block — not after it
- **ALWAYS** capture and display `error` from every `useFetch()` call
- **ALWAYS** use `window.confirm()` before any delete operation
- **ALWAYS** use `<LoadingSpinner />` — never inline spinner divs
- **ALWAYS** use `<AlertMessage />` — never inline error/success banners
- **ALWAYS** use `<StatusBadge />` with constants — never duplicate color maps
- **ALWAYS** use `formatDate()` / `formatINR()` from formatters — never local copies
- **ALWAYS** import from `../../utils/constants` for status color maps
- API base: `api.get('/api/...')` via axios instance in `services/api.js`

### Frontend Error Handling (CRITICAL — most common bug source)

Every component that makes API calls must handle errors at 3 levels:

1. **useFetch errors** — capture and display:
```jsx
const { data, loading, error: fetchErr } = useFetch('/api/items', []);
// In JSX:
{fetchErr && <AlertMessage type="error" message={fetchErr} />}
```

2. **useApi execute errors** — always try-catch:
```jsx
const handleSave = async () => {
  try {
    await execute(() => api.post('/api/items', form), 'Created!');
    refetch();       // success-only
    setShowForm(false); // success-only
  } catch {
    // useApi hook already sets error state — empty catch is correct
  }
};
```

3. **Render-level errors** — ErrorBoundary wraps the entire app (`client/src/components/shared/ErrorBoundary.jsx`), catches React render crashes, and reports to `/api/error-reports`.

**Empty states:** When a dependency fetch returns empty data, show a helpful message instead of a broken form.

## Shared Hooks Reference

```js
// useFetch — auto-fetches on mount, returns data
const { data, loading, error, refetch } = useFetch('/api/path', defaultValue);

// useApi — for button-triggered actions
// ⚠️ CRITICAL: execute() THROWS on API error (re-throws after setting error state)
// Code after await execute() ONLY runs on success
// ALWAYS wrap in try-catch if there's post-success logic (refetch, close modal, reset form)
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
**Misc:** GoogleToken, EmailActivity, ChatActivity, PointLog, ThumbsUp, Appreciation, AppreciationBudget, ShiftDefinition, OvertimeRequest, OtpVerification, WikiArticle, Suggestion, Policy, PolicySection, PolicyAcceptance, PolicyVersion

## Mandatory Completion Checklist (NEVER skip)

Before telling the user "done" or "complete", **verify EVERY item**:

### For ANY feature that has a Save/Edit/Delete button:
1. **Endpoint exists** — The exact API path used in frontend (`api.put('/api/xyz/:id')`) has a matching `router.put('/:id')` in the backend route file
2. **Route registered** — The route file is imported and mounted in `server/src/app.js` (`app.use('/api/xyz', xyzRoutes)`)
3. **Payload matches** — Fields sent from frontend form match what backend reads from `req.body`
4. **Prisma model fields exist** — Every field in `req.body` exists in the Prisma schema model
5. **try-catch wraps execute()** — Every `await execute()` is inside try-catch (execute THROWS on error)
6. **refetch() called** — Inside the try block after `execute()`, call `refetch()` to reload data
7. **Modal closes** — Inside the try block, reset form state AND close the modal/form
8. **Error shown** — `{saveErr && <AlertMessage type="error" message={saveErr} />}` is in JSX
9. **Delete confirms** — Every `api.delete()` call has `window.confirm()` before execution
10. **useFetch error captured** — Every `useFetch()` destructures `error` and displays it via `<AlertMessage />`

### The #1 Bug Pattern — Missing try-catch on execute() (fix EVERY time):

`execute()` in `useApi` hook **THROWS on API error**. Without try-catch, any code after
`await execute()` (refetch, close modal, reset form) is silently skipped on error,
AND React may show an unhandled promise rejection.

```jsx
// ❌ WRONG — on API error, refetch/close/reset are skipped AND unhandled rejection
const handleSave = async () => {
  await execute(() => api.put(`/api/items/${id}`, form), 'Updated!');
  refetch();
  setEditing(null);
  reset();
};

// ✅ CORRECT — try-catch ensures graceful error handling
const handleSave = async () => {
  try {
    await execute(() => api.put(`/api/items/${id}`, form), 'Updated!');
    refetch();          // ← RELOAD data (only on success)
    setEditing(null);   // ← CLOSE modal (only on success)
    reset();            // ← RESET form (only on success)
  } catch {
    // Error already displayed by useApi hook (sets error state automatically)
  }
};

// ❌ ALSO WRONG — no refetch after success
const handleSave = async () => {
  try {
    await execute(() => api.put(`/api/items/${id}`, form), 'Updated!');
    // Missing refetch()! Data won't refresh.
  } catch {}
};
```

**Rule: EVERY `await execute()` call MUST be inside try-catch with refetch() in the try block.**

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

**Manual audit checklist (things audit.js doesn't catch):**
- Every `await execute()` is wrapped in try-catch (execute THROWS on error)
- Every `useFetch()` error is captured and displayed via `<AlertMessage />`
- Every `api.delete()` has `window.confirm()` before execution
- Empty states shown when dependency data is unavailable (e.g., no modules for contribution form)
- Form modals include both success and error `<AlertMessage />` components

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

**Environment Variables (must be set in BOTH `server/.env` AND Vercel dashboard):**

| Var | Purpose | Where Set |
|-----|---------|-----------|
| `DATABASE_URL` / `DIRECT_URL` | Neon PostgreSQL | `.env` + Vercel |
| `CLERK_SECRET_KEY` / `CLERK_JWT_KEY` | Clerk auth backend | `.env` + Vercel |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk auth frontend (build-time) | `.env` + Vercel |
| `GOOGLE_CLIENT_ID` | Google OAuth2 user consent | `.env` + Vercel |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 secret | `.env` + Vercel |
| `GOOGLE_REDIRECT_URI` | OAuth2 callback URL | `.env` (localhost) + Vercel (eod.colorpapers.in) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` / `_PATH` | Service account for Drive/Workspace | `_PATH` local, `_KEY` (JSON string) Vercel |
| `GOOGLE_ADMIN_EMAIL` | Service account delegation email | `.env` + Vercel |
| `GOOGLE_WORKSPACE_DOMAIN` | Workspace domain | `.env` + Vercel |

**When adding new env vars:** Always set in BOTH local `.env` AND Vercel dashboard. Use `vercel env add VARNAME production` for CLI, or Vercel Dashboard → Settings → Environment Variables.

## AI Architecture (aiRouter)

All AI calls route through `server/src/services/aiRouter.js`:
- **Primary:** Requesty.ai (cost-ordered, 433+ models) — API key from Settings DB (`requesty_api_key`), falls back to `REQUESTY_API_KEY` env var
- **Fallback:** Google Gemini SDK direct — API key from Settings DB (`gemini_api_key`)
- **Admin UI:** Settings → AI Configuration → both keys editable with password-masked inputs

| Feature | File | aiRouter Task Type | AI Needed? |
|---------|------|-------------------|------------|
| Resume Extraction | `routes/extraction.js` | `text_extraction` | Yes |
| Invoice/Receipt OCR | `services/invoiceExtractor.js` | `vision_extraction` | Yes |
| Profile Photo Cleanup | `services/photoProcessor.js` | `image_edit` | Yes |
| Error Report Diagnosis | `routes/errorReports.js` | `code_analysis` | Yes |
| Gmail Renewal Scanner | `services/gmailRenewalScanner.js` | `text_extraction` | Yes |
| Email Work Tracker | `services/google/googleGmail.js` | None (rule-based) | No |
| Automation Insights | `services/automationAnalyzer.js` | `classification` | Yes |

## Smart Email Work Tracker

Per-user daily email work tracking for EOD reports. Separate from `gmailRenewalScanner.js` (admin-only renewal detection).

**Key files:**
- `server/src/services/google/googleGmail.js` — Gmail fetcher, two-level Company→Thread grouping, categorization
- `server/src/services/google/googleCalendar.js` — Tasks read + `upsertGoogleTask()` write (upsert by threadId)
- `server/src/routes/google.js` — `GET /auto-tasks` (enhanced), `POST /push-to-tasks`, `POST /mark-handled`
- `client/src/components/google/GoogleSuggestions.jsx` — 3-tab UI (Today's Work, Needs Attention, Summary)
- `server/prisma/schema.prisma` — `EmailHandledThread` model (task closure, 3-day auto-cleanup)

**Google endpoints (`/api/google/`):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auto-tasks?date=YYYY-MM-DD` | Calendar + Tasks + Email details (two-level grouped) |
| POST | `/push-to-tasks` | Upsert Google Tasks for unreplied threads |
| POST | `/mark-handled` | DB-backed closure for email threads |
| GET | `/status` | OAuth status + scope check (hasGmailScope, hasTasksWriteScope) |

**OAuth scopes:** `calendar.readonly` + `tasks` (read+write) + `gmail.readonly`
**Pre-requisite:** Enable Gmail API in GCC project `345624220365`. Users must disconnect + reconnect to grant new scopes.

## Automation Insights (AI-Powered Task Pattern Detection)

Analyzes ALL employees' daily activity reports to detect repetitive/recurring tasks and surface automation opportunities. Located under `/admin/suggestions` page as a second tab.

**Key files:**
- `server/src/services/automationAnalyzer.js` — Two-phase analysis engine (rule-based grouping → AI semantic clustering)
- `server/src/routes/suggestions.js` — 5 endpoints under `/api/suggestions/` prefix
- `client/src/components/admin/SuggestionManager.jsx` — 2-tab layout (Employee Suggestions + Automation Insights)

**Analysis engine (two phases):**
1. **Phase 1 — Rule-based:** Fetch ReportTasks for N days, normalize descriptions (lowercase, strip dates/numbers/filler), group by normalized key, filter frequency ≥ 3
2. **Phase 2 — AI:** Send top 50 clusters to `callAIText('classification', prompt, {prisma})`, AI merges similar clusters, categorizes, suggests automation tools. Falls back to rule-based insights on AI failure.

**Suggestion endpoints (`/api/suggestions/`):**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze-automation` | Trigger analysis (admin, periodDays 7-90) |
| GET | `/automation-insights` | List insights with status/priority/category filters |
| GET | `/automation-stats` | Summary stats (total, byStatus, byPriority, byCategory, saveable hours, last analysis) |
| PUT | `/automation-insights/:id` | Update status/priority/adminNotes |
| DELETE | `/automation-insights/:id` | Soft delete (isActive: false) |

**Cron:** Sunday 11:00 PM IST — weekly auto-analysis of last 30 days (`cronJobs.js`)

**Prisma models:** `AutomationInsight` (pattern data, priority, status, JSON fields for users/tools), `AutomationAnalysisLog` (run metadata)

## Crash Recovery

All code is git-tracked. After any major work:
```bash
cd "D:\Activity Report Software"
git add -A && git commit -m "description"
git push origin main  # auto-deploys to Vercel
```
Recovery: clone from git, run `npm install` in both `server/` and `client/`, then `npx prisma generate`.
Schema sync: `cd server && npx prisma db push` (pushes schema to Neon PostgreSQL).
