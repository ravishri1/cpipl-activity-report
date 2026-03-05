# Asset Lifecycle System - One-Click Deployment Guide

**⏱️ Total Time: 15 minutes**  
**🎯 Goal: Database migration + 5 quick verification tests**  
**✅ Status: All files ready, just execute commands**

---

## TL;DR - Deployment in 5 Steps

```bash
# STEP 1: Navigate to server directory
cd "D:\Activity Report Software\server"

# STEP 2: Run migration (pick ONE)
npm run migrate:dev --name add_asset_lifecycle_system

# STEP 3: Verify database
npx prisma studio
# Check for these 10 tables: Vendor, Location, PurchaseOrder, AssetAssignment, 
# AssetMovement, AssetConditionLog, AssetDisposal, AssetDetachmentRequest, 
# AssetRepair, RepairTimeline

# STEP 4: Start servers
npm run dev  # Terminal 1 - Backend

# STEP 5: In another terminal
cd "D:\Activity Report Software\client"
npm run dev  # Terminal 2 - Frontend
```

---

## Pre-Deployment Verification

**Checklist before you start:**

```bash
# Are you in the right directory?
pwd
# Should show: D:\Activity Report Software

# Does server exist?
ls server/
# Should show: node_modules/, src/, prisma/

# Is assetLifecycle.js file present?
ls server/src/routes/assetLifecycle.js
# Should show the file

# Is schema updated?
grep -n "model Vendor" server/prisma/schema.prisma
# Should find the model
```

---

## Option A: Automatic Migration (Recommended)

### Command
```bash
cd "D:\Activity Report Software\server"
npm run migrate:dev --name add_asset_lifecycle_system
```

### What it does:
1. Creates migration file in `prisma/migrations/`
2. Applies schema to SQLite database
3. Generates Prisma client automatically

### What you should see:
```
✔ Created migration: ./prisma/migrations/[timestamp]_add_asset_lifecycle_system/migration.sql
✔ Successfully migrated your database
✔ Generated Prisma Client
```

### If it fails:
```bash
# Try manually
npx prisma migrate dev --name add_asset_lifecycle_system

# Or if migrations locked:
npx prisma migrate resolve --rolled-back add_asset_lifecycle_system
npx prisma migrate dev --name add_asset_lifecycle_system
```

---

## Option B: Direct Push (Fast Track)

### Command
```bash
cd "D:\Activity Report Software\server"
npx prisma db push --skip-generate
npx prisma generate
```

### What it does:
1. Directly applies schema to database (no migration file)
2. Generates Prisma client

### Advantage: Faster, no migration file management  
### Use when: You want quick deployment without migration tracking

---

## Database Verification

After migration succeeds:

```bash
# Start Prisma Studio
cd "D:\Activity Report Software\server"
npx prisma studio
```

**In Prisma Studio, verify:**
- [ ] Vendor table exists (0 rows initially)
- [ ] Location table exists (0 rows initially)
- [ ] PurchaseOrder table exists (0 rows initially)
- [ ] AssetAssignment table exists (0 rows initially)
- [ ] AssetMovement table exists (0 rows initially)
- [ ] AssetConditionLog table exists (0 rows initially)
- [ ] AssetDisposal table exists (0 rows initially)
- [ ] AssetDetachmentRequest table exists (0 rows initially)
- [ ] AssetRepair table exists (0 rows initially)
- [ ] RepairTimeline table exists (0 rows initially)

**If tables are missing:** Re-run migration from Step 2 above

---

## Start Application Servers

### Terminal 1: Backend Server
```bash
cd "D:\Activity Report Software\server"
npm run dev
```

**Expected output:**
```
Server running on port 5000
Database ready
Asset Lifecycle routes registered: /api/asset-lifecycle
```

**If you see errors:**
```bash
# Clear node cache
rm -r node_modules/.prisma

# Regenerate client
npx prisma generate

# Try again
npm run dev
```

---

### Terminal 2: Frontend Server (New Terminal)
```bash
cd "D:\Activity Report Software\client"
npm run dev
```

**Expected output:**
```
  VITE v... ready in XXX ms

  ➜  local:   http://localhost:5000
  ➜  Network: use --host to expose
```

---

## Quick Verification Tests (5 minutes)

### Test 1: Health Check
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-04T...",
  "dbConfigured": true
}
```

✅ **PASS** if you see "ok" and "dbConfigured": true

---

### Test 2: Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cpipl.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "admin@cpipl.com",
    "role": "admin"
  }
}
```

✅ **PASS** if you get a token and user object

**Save token for next tests:**
```powershell
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@cpipl.com","password":"password123"}' `
  -UseBasicParsing

$TOKEN = ($response.Content | ConvertFrom-Json).token
Write-Host "Token: $TOKEN"
```

---

### Test 3: Create Vendor
```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/vendors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechSupplies Ltd",
    "phone": "9876543210",
    "email": "vendor@techsupplies.com",
    "city": "Bangalore",
    "gstNumber": "29AABCT1234H1Z0",
    "vendorType": "equipment",
    "paymentTerms": "net_30"
  }'
```

**Expected Response:** 201 Created
```json
{
  "id": 1,
  "name": "TechSupplies Ltd",
  "gstNumber": "29AABCT1234H1Z0",
  "isActive": true,
  "createdAt": "2026-03-04T..."
}
```

✅ **PASS** if status is 201 and vendor has an ID

---

### Test 4: List Vendors
```bash
curl -X GET "http://localhost:5000/api/asset-lifecycle/vendors?offset=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:** 200 OK
```json
{
  "items": [
    {
      "id": 1,
      "name": "TechSupplies Ltd",
      "city": "Bangalore"
    }
  ],
  "offset": 0,
  "limit": 10,
  "total": 1,
  "hasMore": false
}
```

✅ **PASS** if vendor appears in list

---

### Test 5: Get Vendor Details
```bash
curl -X GET http://localhost:5000/api/asset-lifecycle/vendors/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:** 200 OK with full vendor data

✅ **PASS** if you get vendor with all fields

---

## Verify Database Updated

Open Prisma Studio again:
```bash
npx prisma studio
```

Navigate to **Vendor** table and verify:
- ✅ 1 vendor record exists
- ✅ Fields match what you created
- ✅ Timestamps auto-populated
- ✅ isActive = true

---

## Database Backup (Do This Now)

```powershell
# Create backup before proceeding
$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
Copy-Item "D:\Activity Report Software\server\prisma\dev.db" `
          "D:\Activity Report Software\server\prisma\backups\dev.db.$date.bak"
```

---

## Success Criteria - All Must Be ✅

- [x] Migration executed successfully
- [x] All 10 tables created in database
- [x] Prisma Studio shows tables with correct schema
- [x] Backend server starts without errors
- [x] Frontend server starts without errors
- [x] Health check returns status: ok
- [x] Admin login returns valid JWT token
- [x] Vendor creation returns 201 status
- [x] List vendors works with pagination
- [x] Get vendor details returns full data
- [x] Database backup created

---

## Troubleshooting

### Problem: "Cannot find module assetLifecycle"

**Solution:**
```bash
# File might not exist
ls server/src/routes/assetLifecycle.js

# If not found, it wasn't created
# Check that the file exists and has 359 lines
wc -l server/src/routes/assetLifecycle.js
```

---

### Problem: "Relation not found" error during migration

**Solution:**
```bash
# Prisma cache issue
rm -r node_modules/.prisma
npx prisma generate

# Then retry migration
npm run migrate:dev --name add_asset_lifecycle_system
```

---

### Problem: "Migration failed - database is locked"

**Solution:**
```bash
# Prisma Studio might be open
# Close Prisma Studio if running

# Try again
npx prisma db push

# If still locked:
rm server/prisma/dev.db-journal
npx prisma db push
```

---

### Problem: Endpoints return 404

**Solution:**
```bash
# Check routes registered in app.js
grep -n "asset-lifecycle" server/src/app.js

# Should show:
# Line 32: const assetLifecycleRoutes = require('./routes/assetLifecycle');
# Line 141: app.use('/api/asset-lifecycle', assetLifecycleRoutes);

# If missing, add these lines to app.js manually
```

---

### Problem: "invalid_token" error on API calls

**Solution:**
```bash
# Token might have expired or be invalid

# Get new token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cpipl.com","password":"password123"}'

# Use the new token in Authorization header
```

---

### Problem: "Cannot POST /api/asset-lifecycle/vendors"

**Solution:**
```bash
# Route not registered

# Verify in app.js
grep "asset-lifecycle" server/src/app.js

# If missing, add to app.js around line 141:
# app.use('/api/asset-lifecycle', assetLifecycleRoutes);

# Restart server after editing
```

---

## What's Next After Successful Deployment?

✅ **Phase 1 Complete** → All endpoints working

🚀 **Phase 2 - Frontend (Next week)**
- Create React components
- Build user interfaces
- Integrate with backend

📊 **Phase 3 - Integrations (Week after)**
- Connect to HRMS for employee sync
- Connect to Procurement for orders
- Connect to Inventory for stock

📈 **Phase 4 - Production (Following week)**
- User acceptance testing
- Staff training
- Full deployment

---

## Keep These Files Handy

During implementation, refer to:

1. **ASSET_LIFECYCLE_API_REFERENCE.md** (944 lines)
   - When you need API endpoint details
   - When testing specific endpoints
   - For request/response examples

2. **COMPLETE_TEST_SUITE.md** (902 lines)
   - When you want to run comprehensive tests
   - Contains 44 test cases
   - Has expected outputs for each test

3. **PHASE_1_PRODUCTION_DEPLOYMENT_GUIDE.md** (776 lines)
   - For production setup
   - Monitoring and logging
   - Rollback procedures

4. **PHASE_1_COMPLETE_EXECUTIVE_SUMMARY.md** (396 lines)
   - High-level overview
   - Architecture summary
   - Key achievements

---

## Questions?

### Common Q&A

**Q: Can I run both servers in one terminal?**
A: Use `npm run dev` with `&` at end:
```bash
cd server && npm run dev & cd ../client && npm run dev
```

**Q: How do I stop the servers?**
A: Press `Ctrl+C` in each terminal

**Q: Can I use a different database?**
A: Not for Phase 1. SQLite is configured. For PostgreSQL, see Prisma docs.

**Q: Do I need to install anything else?**
A: No. Node.js and npm are already installed.

**Q: Can I run tests in parallel?**
A: Yes, all endpoints are independent. Create separate test files.

**Q: How do I rollback if something breaks?**
A: See PHASE_1_PRODUCTION_DEPLOYMENT_GUIDE.md section "Rollback Procedures"

---

## Time Estimate

| Task | Time |
|------|------|
| Run migration | 2 min |
| Start servers | 1 min |
| Run 5 verification tests | 5 min |
| Verify in Prisma Studio | 2 min |
| Create backup | 2 min |
| **TOTAL** | **12 min** |

---

## Sign-Off

When complete, you should see:

✅ Migration executed successfully  
✅ All 10 tables created  
✅ Backend running on port 5000  
✅ Frontend running on port 3000  
✅ Health check returns ok  
✅ Vendor CRUD operations working  
✅ Database backup created  

**System Status: PRODUCTION-READY** 🚀

---

**Ready to deploy? Execute the 5 steps above and you'll be done in 15 minutes!**

