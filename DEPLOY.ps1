# ============================================================
#  CPIPL Activity Report — Full Project Deployment Script
#  PowerShell for Windows
#  Run: Right-click → "Run with PowerShell" (as Administrator)
# ============================================================

param(
    [ValidateSet("setup", "build", "start", "vercel", "status")]
    [string]$Action = "setup"
)

$ErrorActionPreference = "Stop"

function Write-Step($step, $msg) {
    Write-Host "`n[$step] $msg" -ForegroundColor Yellow
}
function Write-Ok($msg) {
    Write-Host "  OK: $msg" -ForegroundColor Green
}
function Write-Warn($msg) {
    Write-Host "  WARNING: $msg" -ForegroundColor DarkYellow
}
function Write-Fail($msg) {
    Write-Host "  FAILED: $msg" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  CPIPL Activity Report — Deployment Tool" -ForegroundColor Cyan
Write-Host "  Action: $Action" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ──────────────────────────────────────────────
#  ACTION: setup — Full first-time setup
# ──────────────────────────────────────────────
if ($Action -eq "setup") {

    # 1. Prerequisites
    Write-Step "1/9" "Checking prerequisites..."

    # Node.js
    $nodeExists = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeExists) {
        Write-Fail "Node.js is NOT installed!"
        Write-Host "  Download: https://nodejs.org (v18+ LTS)" -ForegroundColor Gray
        exit 1
    }
    $nodeVer = & node --version
    Write-Ok "Node.js $nodeVer"

    # npm
    $npmVer = & npm --version
    Write-Ok "npm v$npmVer"

    # Git
    $gitExists = Get-Command git -ErrorAction SilentlyContinue
    if ($gitExists) {
        $gitVer = & git --version
        Write-Ok "$gitVer"
    } else {
        Write-Warn "Git not installed — won't be able to push/deploy"
    }

    # 2. Backend install
    Write-Step "2/9" "Installing backend dependencies..."
    Set-Location "$rootDir\server"
    & npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { Write-Fail "Backend npm install failed"; exit 1 }
    Write-Ok "Backend dependencies installed"
    Set-Location $rootDir

    # 3. Environment files
    Write-Step "3/9" "Checking environment files..."

    if (-not (Test-Path "$rootDir\server\.env")) {
        if (Test-Path "$rootDir\server\.env.example") {
            Copy-Item "$rootDir\server\.env.example" "$rootDir\server\.env"
            Write-Warn "Created server\.env from template — EDIT IT with your real values!"
        } else {
            Write-Fail "No server\.env or .env.example found!"
        }
    } else {
        Write-Ok "server\.env exists"
    }

    if (-not (Test-Path "$rootDir\client\.env")) {
        if (Test-Path "$rootDir\client\.env.example") {
            Copy-Item "$rootDir\client\.env.example" "$rootDir\client\.env"
            Write-Warn "Created client\.env from template — EDIT IT with Clerk key!"
        }
    } else {
        Write-Ok "client\.env exists"
    }

    # 4. Prisma generate
    Write-Step "4/9" "Generating Prisma database client..."
    Set-Location "$rootDir\server"
    & npx prisma generate
    if ($LASTEXITCODE -ne 0) { Write-Fail "Prisma generate failed"; Set-Location $rootDir; exit 1 }
    Write-Ok "Prisma client generated"
    Set-Location $rootDir

    # 5. Database push
    Write-Step "5/9" "Pushing schema to PostgreSQL (creates 70+ tables)..."
    Set-Location "$rootDir\server"
    & npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Database push failed — check DATABASE_URL in server\.env"
        Set-Location $rootDir
        exit 1
    }
    Write-Ok "Database schema pushed"
    Set-Location $rootDir

    # 6. Frontend install
    Write-Step "6/9" "Installing frontend dependencies..."
    Set-Location "$rootDir\client"
    & npm install --include=dev --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { Write-Fail "Frontend npm install failed"; Set-Location $rootDir; exit 1 }
    Write-Ok "Frontend dependencies installed"
    Set-Location $rootDir

    # 7. Frontend build
    Write-Step "7/9" "Building frontend for production..."
    Set-Location "$rootDir\client"
    & npx vite build
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Frontend build failed — check VITE_CLERK_PUBLISHABLE_KEY in client\.env"
    } else {
        Write-Ok "Frontend built to client\dist\"
    }
    Set-Location $rootDir

    # 8. Google service account
    Write-Step "8/9" "Checking Google service account..."
    if (Test-Path "$rootDir\server\google-service-account.json") {
        Write-Ok "google-service-account.json found"
    } else {
        Write-Warn "google-service-account.json NOT found — file uploads won't work"
    }

    # 9. Audit
    Write-Step "9/9" "Running audit check..."
    if (Test-Path "$rootDir\scripts\audit.js") {
        Set-Location $rootDir
        & node scripts/audit.js 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Audit passed"
        } else {
            Write-Warn "Audit had warnings — run 'node scripts/audit.js' for details"
        }
    } else {
        Write-Warn "audit.js not found, skipping"
    }
    Set-Location $rootDir

    # Done
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "    1. Edit server\.env with your real credentials" -ForegroundColor White
    Write-Host "    2. Edit client\.env with VITE_CLERK_PUBLISHABLE_KEY" -ForegroundColor White
    Write-Host "    3. Place google-service-account.json in server\" -ForegroundColor White
    Write-Host ""
    Write-Host "  Start dev servers:" -ForegroundColor Cyan
    Write-Host "    .\DEPLOY.ps1 -Action start" -ForegroundColor White
    Write-Host ""
    Write-Host "  Or manually:" -ForegroundColor Cyan
    Write-Host "    Terminal 1: cd server && npm run dev" -ForegroundColor Gray
    Write-Host "    Terminal 2: cd client && npm run dev" -ForegroundColor Gray
    Write-Host "    Open: http://localhost:3000" -ForegroundColor Gray
    Write-Host ""
}

# ──────────────────────────────────────────────
#  ACTION: build — Build frontend only
# ──────────────────────────────────────────────
elseif ($Action -eq "build") {
    Write-Step "1/2" "Installing frontend dependencies..."
    Set-Location "$rootDir\client"
    & npm install --include=dev --legacy-peer-deps
    Write-Ok "Done"

    Write-Step "2/2" "Building frontend..."
    & npx vite build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Build failed!"
        Set-Location $rootDir
        exit 1
    }
    Write-Ok "Built to client\dist\"
    Set-Location $rootDir

    $distSize = (Get-ChildItem "$rootDir\client\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  Build size: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray
}

# ──────────────────────────────────────────────
#  ACTION: start — Start both servers
# ──────────────────────────────────────────────
elseif ($Action -eq "start") {
    Write-Step "1/2" "Starting backend server (port 5000)..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\server'; npm run dev"
    Write-Ok "Backend starting in new window"

    Start-Sleep -Seconds 2

    Write-Step "2/2" "Starting frontend server (port 3000)..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\client'; npm run dev"
    Write-Ok "Frontend starting in new window"

    Write-Host ""
    Write-Host "  Both servers starting..." -ForegroundColor Cyan
    Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
    Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "  Opening browser in 5 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000"
}

# ──────────────────────────────────────────────
#  ACTION: vercel — Deploy to Vercel
# ──────────────────────────────────────────────
elseif ($Action -eq "vercel") {
    # Check Vercel CLI
    $vercelExists = Get-Command vercel -ErrorAction SilentlyContinue
    if (-not $vercelExists) {
        Write-Step "0" "Installing Vercel CLI..."
        & npm install -g vercel
    }

    Write-Step "1/3" "Checking git status..."
    Set-Location $rootDir
    $status = & git status --porcelain
    if ($status) {
        Write-Warn "You have uncommitted changes:"
        & git status --short
        Write-Host ""
        $confirm = Read-Host "  Commit and push? (y/n)"
        if ($confirm -eq "y") {
            $msg = Read-Host "  Commit message"
            & git add -A
            & git commit -m $msg
        } else {
            Write-Host "  Skipping commit" -ForegroundColor Gray
        }
    } else {
        Write-Ok "Working directory clean"
    }

    Write-Step "2/3" "Pushing to GitHub..."
    & git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Git push failed!"
        exit 1
    }
    Write-Ok "Pushed to GitHub — Vercel auto-deploy triggered"

    Write-Step "3/3" "Vercel deployment status..."
    Write-Host "  Vercel auto-deploys from GitHub push." -ForegroundColor Gray
    Write-Host "  Check status at: https://vercel.com/dashboard" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or run: vercel --prod" -ForegroundColor Gray
}

# ──────────────────────────────────────────────
#  ACTION: status — Check system status
# ──────────────────────────────────────────────
elseif ($Action -eq "status") {
    Write-Host ""

    # Node
    $nodeVer = & node --version 2>$null
    if ($nodeVer) { Write-Ok "Node.js $nodeVer" } else { Write-Fail "Node.js not found" }

    # npm
    $npmVer = & npm --version 2>$null
    if ($npmVer) { Write-Ok "npm v$npmVer" } else { Write-Fail "npm not found" }

    # Git
    $gitVer = & git --version 2>$null
    if ($gitVer) { Write-Ok "$gitVer" } else { Write-Warn "Git not found" }

    # server node_modules
    if (Test-Path "$rootDir\server\node_modules") {
        Write-Ok "server\node_modules exists"
    } else {
        Write-Fail "server\node_modules missing — run: cd server && npm install"
    }

    # client node_modules
    if (Test-Path "$rootDir\client\node_modules") {
        Write-Ok "client\node_modules exists"
    } else {
        Write-Fail "client\node_modules missing — run: cd client && npm install"
    }

    # client dist
    if (Test-Path "$rootDir\client\dist\index.html") {
        $distSize = (Get-ChildItem "$rootDir\client\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-Ok "client\dist\ exists ($([math]::Round($distSize, 2)) MB)"
    } else {
        Write-Warn "client\dist\ not built — run: cd client && npx vite build"
    }

    # .env files
    if (Test-Path "$rootDir\server\.env") { Write-Ok "server\.env exists" }
    else { Write-Fail "server\.env MISSING" }

    if (Test-Path "$rootDir\client\.env") { Write-Ok "client\.env exists" }
    else { Write-Fail "client\.env MISSING" }

    # Google service account
    if (Test-Path "$rootDir\server\google-service-account.json") {
        Write-Ok "google-service-account.json exists"
    } else {
        Write-Warn "google-service-account.json missing"
    }

    # Prisma client
    if (Test-Path "$rootDir\server\node_modules\.prisma") {
        Write-Ok "Prisma client generated"
    } else {
        Write-Warn "Prisma client not generated — run: cd server && npx prisma generate"
    }

    # Git status
    Write-Host ""
    Set-Location $rootDir
    $branch = & git rev-parse --abbrev-ref HEAD 2>$null
    $lastCommit = & git log --oneline -1 2>$null
    if ($branch) {
        Write-Host "  Git branch: $branch" -ForegroundColor Gray
        Write-Host "  Last commit: $lastCommit" -ForegroundColor Gray
    }

    Write-Host ""
}

Set-Location $rootDir
