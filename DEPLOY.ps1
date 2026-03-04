# Asset Lifecycle System - Automated Deployment Script
# PowerShell script for Windows - Executes Phase 1 deployment

Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Asset Lifecycle System - Phase 1 Deployment               ║" -ForegroundColor Cyan
Write-Host "║                  🚀 Automated Deployment Script                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify prerequisites
Write-Host "Step 1: Verifying prerequisites..." -ForegroundColor Yellow
$currentPath = Get-Location
Write-Host "Current directory: $currentPath" -ForegroundColor Gray

if (Test-Path "server/prisma/schema.prisma") {
    Write-Host "✅ Schema file found" -ForegroundColor Green
} else {
    Write-Host "❌ Schema file not found. Make sure you're in the Activity Report Software directory" -ForegroundColor Red
    exit 1
}

if (Test-Path "server/src/routes/assetLifecycle.js") {
    Write-Host "✅ Asset Lifecycle routes found" -ForegroundColor Green
} else {
    Write-Host "❌ Asset Lifecycle routes not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create backup
Write-Host "Step 2: Creating database backup..." -ForegroundColor Yellow
$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupPath = "server/prisma/backups/dev.db.$date.bak"

# Create backups folder if it doesn't exist
if (-not (Test-Path "server/prisma/backups")) {
    New-Item -ItemType Directory -Path "server/prisma/backups" -Force | Out-Null
}

if (Test-Path "server/prisma/dev.db") {
    Copy-Item "server/prisma/dev.db" -Destination $backupPath
    Write-Host "✅ Backup created: $backupPath" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No existing database (first run)" -ForegroundColor Cyan
}

Write-Host ""

# Step 3: Run migration
Write-Host "Step 3: Running database migration..." -ForegroundColor Yellow
Push-Location "server"

# Clear Prisma cache
if (Test-Path "node_modules/.prisma") {
    Remove-Item -Recurse "node_modules/.prisma" -Force
    Write-Host "✅ Cleared Prisma cache" -ForegroundColor Green
}

# Run migration
Write-Host "Executing: npm run migrate:dev --name add_asset_lifecycle_system" -ForegroundColor Gray
npm run migrate:dev --name add_asset_lifecycle_system

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host ""

# Step 4: Verify schema
Write-Host "Step 4: Verifying database schema..." -ForegroundColor Yellow
npx prisma validate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Schema is valid" -ForegroundColor Green
} else {
    Write-Host "⚠️  Schema validation had issues" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Generate Prisma client
Write-Host "Step 5: Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "Step 6: Quick verification tests..." -ForegroundColor Yellow

# Test 1: Health check
Write-Host "  Test 1: Health check..." -ForegroundColor Gray
$healthCheck = $null
$retries = 0
$maxRetries = 5

while ($retries -lt $maxRetries) {
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 5
        if ($healthCheck.StatusCode -eq 200) {
            Write-Host "  ✅ Health check passed" -ForegroundColor Green
            break
        }
    } catch {
        $retries++
        if ($retries -lt $maxRetries) {
            Write-Host "    ⏳ Waiting for server to start... (attempt $retries/$maxRetries)" -ForegroundColor Gray
            Start-Sleep -Seconds 2
        }
    }
}

if ($retries -ge $maxRetries) {
    Write-Host "  ⚠️  Could not reach health check. Make sure backend is running on port 5000" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✅ DEPLOYMENT COMPLETE                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Start the backend server (Terminal 1):" -ForegroundColor White
Write-Host "   cd server && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Start the frontend server (Terminal 2):" -ForegroundColor White
Write-Host "   cd client && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Open Prisma Studio to verify tables:" -ForegroundColor White
Write-Host "   cd server && npx prisma studio" -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  Run verification tests:" -ForegroundColor White
Write-Host "   See COMPLETE_TEST_SUITE.md for 44 comprehensive tests" -ForegroundColor Gray
Write-Host ""
Write-Host "5️⃣  Get admin token and test endpoints:" -ForegroundColor White
Write-Host "   curl -X POST http://localhost:5000/api/auth/login \" -ForegroundColor Gray
Write-Host "     -H 'Content-Type: application/json' \" -ForegroundColor Gray
Write-Host "     -d '{\"email\":\"admin@cpipl.com\",\"password\":\"password123\"}'" -ForegroundColor Gray
Write-Host ""
Write-Host "Database backup created at: $backupPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed information, see:" -ForegroundColor Cyan
Write-Host "  - README_PHASE_1_START_HERE.md" -ForegroundColor Gray
Write-Host "  - PHASE_1_ONE_CLICK_DEPLOYMENT.md" -ForegroundColor Gray
Write-Host "  - COMPLETE_TEST_SUITE.md" -ForegroundColor Gray
Write-Host ""
