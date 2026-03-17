# CPIPL Activity Report — Complete Deployment Guide

> Everything needed to deploy this project on a new system/server.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites (Install These First)](#2-prerequisites)
3. [External Services (Cloud Accounts)](#3-external-services)
4. [Step-by-Step: Local Development Setup](#4-local-development-setup)
5. [Step-by-Step: Production Deployment (Vercel)](#5-production-deployment-vercel)
6. [Step-by-Step: Production Deployment (VPS/Own Server)](#6-production-deployment-vps)
7. [Environment Variables Reference](#7-environment-variables)
8. [Post-Deployment Checklist](#8-post-deployment-checklist)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  React SPA  │────>│  Express API │────>│  Neon PostgreSQL│
│  (Vite)     │     │  (Node.js)   │     │  (Cloud DB)     │
│  Port 3000  │     │  Port 5000   │     │                 │
└─────────────┘     └──────┬───────┘     └────────────────┘
                           │
                    ┌──────┴───────┐
                    │  External    │
                    │  Services    │
                    ├──────────────┤
                    │ Clerk (Auth) │
                    │ Google Drive │
                    │ Gmail SMTP   │
                    │ Google OAuth │
                    │ Requesty AI  │
                    │ Gemini AI    │
                    └──────────────┘
```

| Component | Technology | Notes |
|-----------|-----------|-------|
| Frontend | React 19 + Vite 7 + Tailwind 4 | SPA, builds to `client/dist/` |
| Backend | Node.js + Express 4 + Prisma 6 | REST API, 50 route modules |
| Database | PostgreSQL (Neon) | Cloud-hosted, 70+ models |
| Auth | Clerk SSO | JWT-based, no password login |
| File Storage | Google Drive API | Service account with domain delegation |
| Email | Gmail SMTP (Nodemailer) | App password required |
| AI | Requesty.ai → Gemini fallback | For resume extraction, OCR, etc. |
| Scheduler | node-cron | Reminders, cleanup jobs |

---

## 2. Prerequisites (Install These First)

### On Development Machine (Windows/Mac/Linux)

| Software | Version | Download | Check Command |
|----------|---------|----------|---------------|
| **Node.js** | 18+ (LTS recommended) | https://nodejs.org | `node --version` |
| **npm** | 9+ (comes with Node) | (included) | `npm --version` |
| **Git** | Any recent | https://git-scm.com | `git --version` |
| **VS Code** | Any (optional) | https://code.visualstudio.com | - |

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 2 GB | 4 GB |
| Disk | 1 GB | 2 GB |
| OS | Windows 10+, Ubuntu 20+, macOS 12+ | Any modern OS |
| Internet | Required (cloud DB + services) | Stable broadband |

---

## 3. External Services (Cloud Accounts Needed)

You need accounts on these services. **All are FREE tier compatible.**

### 3a. Neon PostgreSQL (Database)

1. Go to https://neon.tech → Sign up (free)
2. Create a new project (any name, e.g., "cpipl-hr")
3. Select region closest to your server
4. Copy these TWO connection strings:
   - **Pooled connection** → `DATABASE_URL`
   - **Direct connection** → `DIRECT_URL`

### 3b. Clerk (Authentication)

1. Go to https://clerk.com → Sign up (free, 10K MAU)
2. Create application → name it "CPIPL Activity Report"
3. Enable: Google SSO (recommended) or Email/Password
4. From Dashboard → API Keys, copy:
   - `CLERK_SECRET_KEY` (starts with `sk_live_`)
   - `CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
5. From JWT Templates → copy `CLERK_JWT_KEY`
6. Add your production domain in: Settings → Domains

### 3c. Google Cloud Console (OAuth + Drive + Gmail)

1. Go to https://console.cloud.google.com → Create project
2. **Enable these APIs:**
   - Google Drive API
   - Google Calendar API
   - Google Tasks API
   - Gmail API
   - Admin SDK API (for Workspace)

3. **Create OAuth2 Client:**
   - APIs & Credentials → Create Credentials → OAuth 2.0 Client ID
   - Type: Web application
   - Authorized redirect URIs:
     - `http://localhost:5000/api/google/callback` (local dev)
     - `https://YOUR-DOMAIN.com/api/google/callback` (production)
   - Copy: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

4. **Create Service Account:**
   - APIs & Credentials → Create Credentials → Service Account
   - Download JSON key file → save as `google-service-account.json`
   - Enable Domain-wide Delegation (if using Google Workspace)
   - In Google Workspace Admin → Security → API Controls → Domain-wide Delegation:
     - Add client ID from service account
     - Scopes: `https://www.googleapis.com/auth/drive`, `https://www.googleapis.com/auth/admin.directory.user.readonly`

### 3d. Gmail SMTP (Email Sending)

1. Use a Gmail account (e.g., `yourcompany@gmail.com`)
2. Enable 2-Factor Authentication on the account
3. Go to: https://myaccount.google.com/apppasswords
4. Generate App Password → select "Mail"
5. Copy the 16-character password → `GMAIL_APP_PASSWORD`

### 3e. AI Services (Optional but Recommended)

**Requesty.ai (Primary AI):**
1. Go to https://requesty.ai → Sign up
2. Get API key → `REQUESTY_API_KEY`

**Google Gemini (Fallback AI):**
1. Go to https://aistudio.google.com → Get API key
2. Copy key → store in app Settings as `gemini_api_key`

### 3f. Vercel (If Deploying to Vercel)

1. Go to https://vercel.com → Sign up with GitHub
2. Import your repository
3. Set environment variables (see Section 7)

---

## 4. Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/ravishri1/cpipl-activity-report.git
cd cpipl-activity-report
```

### Step 2: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 3: Create Backend Environment File

Create `server/.env` with ALL required variables (see Section 7 for full list):

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require

# Server
PORT=5000
JWT_SECRET=any-random-string-here

# Auth (Clerk)
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# Email
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
TEAM_LEAD_EMAIL=admin@yourcompany.com

# Reminders
REMINDER_TIME_HOUR=21
REMINDER_TIME_MINUTE=0
ESCALATION_TIME_HOUR=11
ESCALATION_TIME_MINUTE=0

# Google OAuth2 (user-level)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback

# Google Service Account (admin-level)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
GOOGLE_ADMIN_EMAIL=admin@yourcompany.com
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# AI (optional)
REQUESTY_API_KEY=your-key-here
OLLAMA_ENABLED=false

# Biometric (optional)
BIOMETRIC_AGENT_KEY=your-biometric-key
```

### Step 4: Setup Database

```bash
cd server
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to Neon DB (creates all 70+ tables)
```

Verify:
```bash
npx prisma studio        # Opens browser UI to see your database
```

### Step 5: Install Frontend Dependencies

```bash
cd ../client
npm install --legacy-peer-deps
```

### Step 6: Create Frontend Environment

Create `client/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

### Step 7: Start Development Servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
→ Runs on http://localhost:5000

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```
→ Runs on http://localhost:3000 (proxies /api to :5000)

### Step 8: Create First Admin User

1. Open http://localhost:3000 in browser
2. Sign up via Clerk
3. In Prisma Studio (or directly in Neon), update the user's role to `admin`:
   ```sql
   UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
   ```

---

## 5. Production Deployment (Vercel) — EASIEST

### Step 1: Push to GitHub

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### Step 2: Import in Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework: "Other" (it auto-detects from vercel.json)
4. Root Directory: `.` (default)

### Step 3: Set Environment Variables in Vercel

Go to: Project Settings → Environment Variables → Add each one:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon pooled URL | Production |
| `DIRECT_URL` | Your Neon direct URL | Production |
| `JWT_SECRET` | Random string | Production |
| `CLERK_SECRET_KEY` | sk_live_xxx | Production |
| `CLERK_PUBLISHABLE_KEY` | pk_live_xxx | Production |
| `VITE_CLERK_PUBLISHABLE_KEY` | pk_live_xxx | Production |
| `GMAIL_USER` | your@gmail.com | Production |
| `GMAIL_APP_PASSWORD` | xxxx-xxxx | Production |
| `TEAM_LEAD_EMAIL` | admin@company.com | Production |
| `GOOGLE_CLIENT_ID` | xxx.apps.googleusercontent.com | Production |
| `GOOGLE_CLIENT_SECRET` | GOCSPX-xxx | Production |
| `GOOGLE_REDIRECT_URI` | https://YOUR-DOMAIN/api/google/callback | Production |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | {"type":"service_account",...} (entire JSON) | Production |
| `GOOGLE_ADMIN_EMAIL` | admin@company.com | Production |
| `GOOGLE_WORKSPACE_DOMAIN` | company.com | Production |
| `REQUESTY_API_KEY` | Your key | Production |
| `BIOMETRIC_AGENT_KEY` | Your key | Production |

**⚠️ Important:** On Vercel, use `GOOGLE_SERVICE_ACCOUNT_KEY` (paste the ENTIRE JSON content as value), NOT `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`.

### Step 4: Add Custom Domain (Optional)

1. Vercel → Project Settings → Domains
2. Add your domain (e.g., `eod.yourcompany.com`)
3. Update DNS: CNAME record pointing to `cname.vercel-dns.com`
4. Update `GOOGLE_REDIRECT_URI` in Vercel env vars to use new domain
5. Update OAuth redirect URI in Google Cloud Console

### Step 5: Deploy

```bash
git push origin main
```
Vercel auto-deploys. Check the deployment log at vercel.com.

**What Vercel does automatically:**
1. `cd server && npm install && npx prisma generate && npx prisma db push`
2. `cd client && npm install && npx vite build`
3. Serves `client/dist/` as static files
4. Routes `/api/*` through serverless function (`api/index.js`)

---

## 6. Production Deployment (VPS / Own Server)

For deploying on your own Windows Server, Linux VPS, or cloud VM.

### Step 1: Install Prerequisites on Server

**Windows Server:**
```powershell
# Install Node.js (download from https://nodejs.org)
# Install Git (download from https://git-scm.com)

# Verify:
node --version    # Should be 18+
npm --version     # Should be 9+
git --version
```

**Ubuntu/Debian Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
npm install -g pm2    # Process manager (keeps app running)
```

### Step 2: Clone and Install

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd cpipl-activity-report

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install --include=dev --legacy-peer-deps
```

### Step 3: Configure Environment

Create `server/.env` (same as Section 4, Step 3 above, but with production URLs):
- `GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/google/callback`

### Step 4: Build Frontend

```bash
cd client
npx vite build
```
This creates `client/dist/` folder with the compiled React app.

### Step 5: Setup Database

```bash
cd server
npx prisma generate
npx prisma db push
```

### Step 6: Start the Server

**Option A: Using PM2 (Linux — RECOMMENDED)**
```bash
cd server
pm2 start src/index.js --name "cpipl-hr"
pm2 startup    # Auto-start on reboot
pm2 save
```

**Option B: Using PM2 on Windows**
```powershell
npm install -g pm2
cd server
pm2 start src/index.js --name "cpipl-hr"
# For auto-start on Windows: use pm2-windows-startup
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

**Option C: Using Windows Service (NSSM)**
```powershell
# Download NSSM from https://nssm.cc
nssm install CpiplHR "C:\Program Files\nodejs\node.exe" "D:\cpipl-activity-report\server\src\index.js"
nssm set CpiplHR AppDirectory "D:\cpipl-activity-report\server"
nssm start CpiplHR
```

### Step 7: Setup Reverse Proxy (Nginx)

The Express app serves BOTH the API and the frontend (static files from `client/dist/`).

**Nginx config (Linux):**
```nginx
server {
    listen 80;
    server_name eod.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable HTTPS with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d eod.yourcompany.com
```

**Windows (IIS as Reverse Proxy):**
1. Install IIS + URL Rewrite + ARR modules
2. Add reverse proxy rule: forward all traffic to `http://localhost:5000`

### Step 8: Verify

Open `https://YOUR-DOMAIN` in browser. You should see the login page.

---

## 7. Environment Variables (Complete Reference)

### Required (App Won't Work Without These)

| Variable | Example | Where |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Neon dashboard |
| `DIRECT_URL` | `postgresql://user:pass@host-direct/db?sslmode=require` | Neon dashboard |
| `CLERK_SECRET_KEY` | `sk_live_abc123...` | Clerk dashboard |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_abc123...` | Clerk dashboard |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_abc123...` | Same as above (for frontend build) |
| `PORT` | `5000` | Your choice |
| `JWT_SECRET` | `any-random-string-32-chars` | Generate yourself |

### Required for Email Features

| Variable | Example | Where |
|----------|---------|-------|
| `GMAIL_USER` | `hr@yourcompany.com` | Your Gmail |
| `GMAIL_APP_PASSWORD` | `abcd-efgh-ijkl-mnop` | Gmail App Passwords |
| `TEAM_LEAD_EMAIL` | `admin@yourcompany.com` | Your choice |
| `REMINDER_TIME_HOUR` | `21` | 24hr format (9 PM) |
| `REMINDER_TIME_MINUTE` | `0` | 0-59 |
| `ESCALATION_TIME_HOUR` | `11` | 24hr format (11 AM) |
| `ESCALATION_TIME_MINUTE` | `0` | 0-59 |

### Required for Google Integration

| Variable | Example | Where |
|----------|---------|-------|
| `GOOGLE_CLIENT_ID` | `123456.apps.googleusercontent.com` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-abc123` | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://eod.yourco.com/api/google/callback` | Must match GCC |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | `./google-service-account.json` | Local only |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `{"type":"service_account",...}` | Vercel only (JSON string) |
| `GOOGLE_ADMIN_EMAIL` | `admin@yourcompany.com` | Workspace admin |
| `GOOGLE_WORKSPACE_DOMAIN` | `yourcompany.com` | Your domain |

### Optional (Features Still Work Without These)

| Variable | Default | Purpose |
|----------|---------|---------|
| `REQUESTY_API_KEY` | none | AI features (resume extraction, OCR) |
| `BIOMETRIC_AGENT_KEY` | `biometric-sync-key` | eSSL biometric sync |
| `OLLAMA_ENABLED` | `false` | Local AI (Ollama) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3` | Default Ollama model |

---

## 8. Post-Deployment Checklist

After deploying, verify each feature:

| # | Check | How |
|---|-------|-----|
| 1 | App loads | Open your URL in browser → see login page |
| 2 | Auth works | Sign in with Clerk → redirects to dashboard |
| 3 | Admin access | First user needs role set to `admin` in DB |
| 4 | Dashboard loads | `/dashboard` shows stats (or empty state) |
| 5 | Reports work | Create a daily report → save → verify in DB |
| 6 | Email works | Trigger a reminder → check inbox |
| 7 | Google Drive | Upload a file → verify it appears in Drive |
| 8 | Google OAuth | Connect Google account → calendar/tasks load |
| 9 | AI features | Try resume extraction → should parse PDF |
| 10 | Health check | `GET /api/health` returns `{ status: "ok" }` |

### First Admin User Setup

After first login via Clerk, run this SQL to make yourself admin:

```sql
-- In Neon SQL Editor or Prisma Studio:
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

Or use Prisma Studio:
```bash
cd server
npx prisma studio
```
→ Open User table → Find your user → Change `role` to `admin` → Save

---

## 9. Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "Cannot connect to database" | Wrong `DATABASE_URL` | Check Neon connection string, ensure `?sslmode=require` |
| "Clerk: Invalid API key" | Wrong `CLERK_SECRET_KEY` | Copy fresh key from Clerk dashboard |
| Frontend shows blank page | `VITE_CLERK_PUBLISHABLE_KEY` missing | Must be set BEFORE `vite build` (it's build-time) |
| Google OAuth "redirect_uri_mismatch" | URI doesn't match | Must be identical in: env var + Google Cloud Console |
| "Cannot find module '@prisma/client'" | Prisma not generated | Run `npx prisma generate` |
| File upload fails | Service account not configured | Check `GOOGLE_SERVICE_ACCOUNT_KEY` / `_PATH` |
| Emails not sending | App password wrong | Regenerate Gmail App Password |
| 502 on Vercel | Serverless timeout | Check function logs in Vercel dashboard |
| CSS not loading | Old build cache | Delete `client/dist/` and rebuild |

### Useful Commands

```bash
# Check database connection
cd server && npx prisma db pull

# View database in browser
cd server && npx prisma studio

# Check if all tables exist
cd server && npx prisma db push --dry-run

# Build frontend manually
cd client && npx vite build

# Check for broken routes/connections
node scripts/audit.js

# View Vercel logs
vercel logs --follow

# Check PM2 status (VPS)
pm2 status
pm2 logs cpipl-hr
```

---

## Quick Reference: Commands Summary

```bash
# === FIRST TIME SETUP ===
git clone <repo-url>
cd cpipl-activity-report
cd server && npm install                # Install backend
cd ../client && npm install --legacy-peer-deps  # Install frontend
cd ../server && npx prisma generate     # Generate DB client
cd ../server && npx prisma db push      # Create tables

# === DAILY DEVELOPMENT ===
cd server && npm run dev                # Start backend (port 5000)
cd client && npm run dev                # Start frontend (port 3000)

# === PRODUCTION BUILD ===
cd client && npx vite build             # Build frontend → client/dist/
cd server && npm start                  # Start production server

# === DATABASE ===
npx prisma studio                       # Visual DB editor
npx prisma db push                      # Sync schema to DB
npx prisma generate                     # Regenerate client

# === DEPLOY TO VERCEL ===
git add -A && git commit -m "deploy"
git push origin main                    # Auto-deploys!

# === AUDIT ===
node scripts/audit.js                   # Check for broken connections
```
