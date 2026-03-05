# Phase 1: Asset Lifecycle System - Quick Start Guide

**Current Status:** Phase 1.0-1.2 COMPLETE ✅ | Phase 1.3 READY FOR EXECUTION 🚀

---

## TL;DR - What's Done & What's Next

### ✅ What's COMPLETE (Don't Redo)
- Database schema designed (10 models, 27 relationships)
- API endpoints implemented (30 endpoints, 359 lines)
- Routes registered in app.js
- Comprehensive migration & test guides created

### 🚀 What's NEXT (Do This)
1. Run database migration
2. Verify database tables
3. Start backend server
4. Run test procedures
5. Document results

---

## Step-by-Step Execution Guide

### Step 1: Open Terminal and Navigate

```bash
cd D:\Activity Report Software\server
```

### Step 2: Run Migration (Choose One)

**Option A - Recommended (Uses npm script):**
```bash
npm run migrate:dev
```

**Option B - Manual Prisma command:**
```bash
npx prisma migrate dev --name add_asset_lifecycle_system
```

**Option C - Direct push (if migration fails):**
```bash
npx prisma db push
npx prisma generate
```

### Step 3: Verify Database Was Created

```bash
npx prisma studio
```

**This opens:** http://localhost:5555

**What to look for:**
- [ ] Table "Vendor" exists
- [ ] Table "Location" exists
- [ ] Table "PurchaseOrder" exists
- [ ] Table "AssetAssignment" exists
- [ ] Table "AssetMovement" exists
- [ ] Table "AssetConditionLog" exists
- [ ] Table "AssetDisposal" exists
- [ ] Table "AssetDetachmentRequest" exists
- [ ] Table "AssetRepair" exists
- [ ] Table "RepairTimeline" exists

**Close Prisma Studio when done:** Ctrl+C

### Step 4: Start Backend Server

**In Terminal 1:**
```bash
cd D:\Activity Report Software\server
npm run dev
```

**Expected output:**
```
Server running on port 5000
Database connected
Prisma client generated
```

### Step 5: Start Frontend Server

**Open Terminal 2 (New):**
```bash
cd D:\Activity Report Software\client
npm run dev
```

**Expected output:**
```
Local: http://localhost:3000
```

### Step 6: Test the API

**Open Terminal 3 (New):** OR use Postman/API client

#### Test 1: Create a Vendor (Admin only)

```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/vendors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Dell Technologies",
    "phone": "9876543210",
    "email": "sales@dell.com",
    "gstNumber": "18AABCU1234A1Z0",
    "vendorType": "equipment"
  }'
```

**Expected Response (201):**
```json
{
  "id": 1,
  "name": "Dell Technologies",
  "phone": "9876543210",
  "email": "sales@dell.com",
  "gstNumber": "18AABCU1234A1Z0",
  "vendorType": "equipment",
  "isActive": true,
  "createdAt": "2026-03-04T..."
}
```

#### Test 2: List Vendors

```bash
curl http://localhost:5000/api/asset-lifecycle/vendors \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response (200):**
```json
{
  "data": [{
    "id": 1,
    "name": "Dell Technologies",
    "vendorType": "equipment",
    "isActive": true
  }],
  "total": 1,
  "page": 1,
  "hasMore": false
}
```

### Step 7: Get Admin Token

**If you don't have a token, login first:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cpipl.com",
    "password": "password123"
  }'
```

**Response will include:**
```json
{
  "user": { "id": 1, "email": "admin@cpipl.com", "role": "admin" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Use the token in all subsequent requests.**

---

## Quick Test Checklist

After starting servers, run these tests to verify everything works:

- [ ] POST /api/asset-lifecycle/vendors (create vendor)
- [ ] GET /api/asset-lifecycle/vendors (list vendors)
- [ ] GET /api/asset-lifecycle/vendors/1 (get single vendor)
- [ ] PUT /api/asset-lifecycle/vendors/1 (update vendor)
- [ ] POST /api/asset-lifecycle/locations (create location)
- [ ] GET /api/asset-lifecycle/locations (list locations)
- [ ] POST /api/asset-lifecycle/purchase-orders (create PO)
- [ ] GET /api/asset-lifecycle/purchase-orders (list POs)
- [ ] PUT /api/asset-lifecycle/purchase-orders/1/approve (approve PO)
- [ ] GET /api/asset-lifecycle/dashboard (dashboard metrics)

All tests should return with status 200-201.

---

## Common Issues & Fixes

### Issue: "Database not found" or migration fails

**Solution:**
```bash
cd server
npx prisma db push
npx prisma generate
```

### Issue: "PORT 5000 already in use"

**Solution:**
```bash
# Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
npm run dev
```

### Issue: "401 Unauthorized" on API calls

**Solution:**
- Get token first via /api/auth/login
- Use token in Authorization header
- OR check if user has "admin" role

### Issue: "Cannot POST /api/asset-lifecycle/vendors"

**Solution:**
- Verify route is registered in app.js
- Restart server after migration
- Check that assetLifecycle.js exists in routes/

---

## Where to Find Detailed Info

| Topic | File | Lines |
|-------|------|-------|
| Full migration steps | `PHASE_1C_MIGRATION_AND_TESTING_GUIDE.md` | 1082 |
| All 30 test procedures | Same file | All sections |
| Complete session summary | `SESSION_MARCH4_2026_PHASE1_COMPLETE.md` | 513 |
| API endpoint details | `server/src/routes/assetLifecycle.js` | 359 |
| Database schema | `server/prisma/schema.prisma` | Lines 1408-1626 |

---

## Expected Time

| Task | Time |
|------|------|
| Run migration | 1-2 minutes |
| Verify database | 5 minutes |
| Start servers | 3 minutes |
| Quick test (3 endpoints) | 5 minutes |
| Full test suite (30 endpoints) | 30-60 minutes |
| Document results | 10 minutes |
| **Total** | **1-2 hours** |

---

## After Testing

### If All Tests Pass ✅
1. Note any issues found
2. Proceed to Phase 2 (frontend components)
3. Archive this test run results

### If Tests Fail ❌
1. Check error messages carefully
2. Look up issue in troubleshooting section
3. Consult `PHASE_1C_MIGRATION_AND_TESTING_GUIDE.md` for detailed fixes
4. Retry failed tests

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│ React Frontend (Port 3000)                  │
│ - AssetManager.jsx (coming Phase 2)        │
│ - AssetDetail.jsx (coming Phase 2)         │
└────────────────┬────────────────────────────┘
                 │ HTTP Requests
                 ↓
┌─────────────────────────────────────────────┐
│ Express Backend (Port 5000)                 │
│ - /api/asset-lifecycle (30 endpoints)      │
│ - Authentication middleware                 │
│ - Error handling                           │
└────────────────┬────────────────────────────┘
                 │ Prisma ORM
                 ↓
┌─────────────────────────────────────────────┐
│ SQLite Database                             │
│ - 10 Asset Lifecycle models                │
│ - 27 relationships                         │
│ - Proper indexes & constraints             │
└─────────────────────────────────────────────┘
```

---

## Routes Summary

```
POST   /api/asset-lifecycle/vendors
GET    /api/asset-lifecycle/vendors
GET    /api/asset-lifecycle/vendors/:vendorId
PUT    /api/asset-lifecycle/vendors/:vendorId

POST   /api/asset-lifecycle/locations
GET    /api/asset-lifecycle/locations
GET    /api/asset-lifecycle/locations/:locationId
PUT    /api/asset-lifecycle/locations/:locationId

POST   /api/asset-lifecycle/purchase-orders
GET    /api/asset-lifecycle/purchase-orders
PUT    /api/asset-lifecycle/purchase-orders/:poId/approve
POST   /api/asset-lifecycle/purchase-orders/:poId/receive-goods
PUT    /api/asset-lifecycle/purchase-orders/:poId

POST   /api/asset-lifecycle/assets/:assetId/assign
GET    /api/asset-lifecycle/assets/:assetId/assignments
POST   /api/asset-lifecycle/assets/:assetId/return
GET    /api/asset-lifecycle/assignments/history/:userId

POST   /api/asset-lifecycle/movements
GET    /api/asset-lifecycle/assets/:assetId/movements
GET    /api/asset-lifecycle/locations/:locationId/stock

POST   /api/asset-lifecycle/assets/:assetId/condition
GET    /api/asset-lifecycle/assets/:assetId/condition-history

POST   /api/asset-lifecycle/assets/:assetId/disposal
PUT    /api/asset-lifecycle/disposals/:disposalId/approve
GET    /api/asset-lifecycle/disposals

POST   /api/asset-lifecycle/assets/:assetId/request-detachment
PUT    /api/asset-lifecycle/detachment-requests/:requestId/approve
PUT    /api/asset-lifecycle/detachment-requests/:requestId/reject
GET    /api/asset-lifecycle/detachment-requests

GET    /api/asset-lifecycle/dashboard
```

**Total: 30 endpoints in 9 functional groups**

---

## Success Criteria Checklist

Phase 1 is complete when ALL of these are ✅:

- [ ] Migration ran without errors
- [ ] All 10 tables created (verified in Prisma Studio)
- [ ] All 30 endpoints responding correctly (200/201)
- [ ] Authorization working (admin vs employee)
- [ ] Error handling working (400/403/404/409)
- [ ] Pagination working (total, page, hasMore)
- [ ] Data persisting in database
- [ ] No performance issues
- [ ] Test results documented
- [ ] Ready for Phase 2

---

## Next Phase (Phase 2: Frontend)

After Phase 1 testing completes successfully:

### Components to Build (2-3 days)
1. **AssetManager.jsx** - Main asset inventory view
2. **AssetDetail.jsx** - Asset history and details
3. **PurchaseOrderManager.jsx** - PO creation and management
4. **DetachmentForm.jsx** - Employee request forms
5. **Dashboard.jsx** - Asset metrics and reports

### Features to Implement
- Asset listing with filters
- Asset assignment workflow
- Purchase order tracking
- Disposal approval flow
- Dashboard analytics

---

## Files You Have Now

| File | Purpose | Size |
|------|---------|------|
| PHASE_1C_MIGRATION_AND_TESTING_GUIDE.md | Complete testing guide | 1082 lines |
| SESSION_MARCH4_2026_PHASE1_COMPLETE.md | Session summary | 513 lines |
| PHASE_1_QUICK_START.md | This file | 300+ lines |
| server/src/routes/assetLifecycle.js | API implementation | 359 lines |
| server/prisma/schema.prisma | Database schema | 1626 lines |
| server/src/app.js | Route registration | Updated |

---

## Getting Help

### If Migration Fails
→ See "Common Issues" section above  
→ Check `PHASE_1C_MIGRATION_AND_TESTING_GUIDE.md` troubleshooting

### If Tests Fail
→ Read error message carefully  
→ Check endpoint implementation in `assetLifecycle.js`  
→ Use test guide for expected responses

### If You Get Stuck
→ Review this quick start guide  
→ Refer to comprehensive migration guide  
→ Check session summary for architecture

---

## TL;DR Commands to Run

```bash
# Step 1: Run migration
cd D:\Activity Report Software\server
npm run migrate:dev

# Step 2: Verify in Prisma Studio
npx prisma studio
# (Open browser, check tables exist, close with Ctrl+C)

# Step 3: Terminal 1 - Start backend
npm run dev

# Step 4: Terminal 2 - Start frontend
cd D:\Activity Report Software\client
npm run dev

# Step 5: Terminal 3 - Quick test
curl http://localhost:5000/api/asset-lifecycle/vendors \
  -H "Authorization: Bearer <TOKEN>"

# Step 6: Follow full test guide
# See PHASE_1C_MIGRATION_AND_TESTING_GUIDE.md
```

---

**Status:** Ready for immediate execution  
**Time to Phase 1 Complete:** 1-2 hours  
**Time to Phase 2 Start:** 2-3 hours  

🚀 **Let's go!**
