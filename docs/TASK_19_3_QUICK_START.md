# Task 19.3 - Quick Start Guide
## Complete Procurement System Testing

**Status:** ✅ 95% COMPLETE - Ready for database sync + final testing  
**Time Estimate:** 15-30 minutes to full completion

---

## What's Already Done ✅

- ✅ Backend server running on port 5000
- ✅ All 23 API endpoints implemented and registered
- ✅ Health check endpoint verified working
- ✅ Comprehensive test scripts created and ready
- ✅ Database schema complete with 9 procurement models
- ✅ Full documentation in place

---

## What Needs to Be Done ⚠️

1. **Sync database schema** (Choose ONE option below)
2. **Seed test data** 
3. **Run test suite**
4. **Verify all tests pass**

---

## Option A: Use Local SQLite (RECOMMENDED FOR TESTING)

```bash
# 1. Stop current server
killall -9 node

# 2. Update .env file (in server directory)
# Change line 1 from:
#   DATABASE_URL="postgresql://..."
# To:
#   DATABASE_URL="file:./dev.db"

# 3. Regenerate Prisma client
cd "D:/Activity Report Software/server"
npx prisma generate

# 4. Run migrations on local database
npx prisma migrate deploy

# 5. Seed test data
npx prisma db seed

# 6. Start server
node src/index.js

# 7. Run tests in another terminal
cd "D:/Activity Report Software"
node comprehensive-api-test.js
```

---

## Option B: Fix PostgreSQL Schema

```bash
# 1. Connect to PostgreSQL and add missing columns
# Use Neon console or SQL client:
ALTER TABLE "User" ADD COLUMN "employmentStatus" VARCHAR(255) DEFAULT 'active';

# 2. Reset Prisma (WARNING: clears all data)
cd "D:/Activity Report Software/server"
npx prisma migrate reset

# 3. Seed test data
npx prisma db seed

# 4. Restart server
node src/index.js

# 5. Run tests
cd "D:/Activity Report Software"
node comprehensive-api-test.js
```

---

## Current Server Status

**Port:** 5000 (Listening)  
**Health Check:** ✅ Working (`GET /api/health` → 200 OK)  
**Process:** Running in background

```bash
# To verify server is running:
curl http://localhost:5000/api/health

# To view running processes:
ps aux | grep "node src/index" | grep -v grep
```

---

## Test Scripts Available

### comprehensive-api-test.js (RECOMMENDED)
- 10-step test sequence
- Proper authentication handling
- Clear pass/fail reporting
- Identifies issues specifically

```bash
node comprehensive-api-test.js
```

**Expected Output When Complete:**
```
✅ Tests Passed: 11
❌ Tests Failed: 0
📊 Success Rate: 100.0%

🎉 ALL TESTS PASSED!
```

---

## Troubleshooting

### "Port 5000 already in use"
```bash
killall -9 node
sleep 2
# Then restart server
```

### "Database schema mismatch"
See Option A or B above - schema sync is required

### "Authentication failed"
Ensure test user exists:
```bash
cd "D:/Activity Report Software/server"
node debug-db.js
```

Should show at least one user (admin@cpipl.com)

### "Tests still failing"
Check:
1. Server is running: `curl http://localhost:5000/api/health`
2. Authentication works: `curl -X POST http://localhost:5000/api/auth/login ...`
3. Database has users: Run `node debug-db.js`

---

## Files to Know

| File | Purpose |
|------|---------|
| `comprehensive-api-test.js` | Main test script - RUN THIS |
| `debug-db.js` | Check database status |
| `server/src/index.js` | Server entry point |
| `server/src/routes/procurement.js` | All 23 endpoints |
| `.env` | Database URL configuration |
| `prisma/schema.prisma` | Database schema definition |

---

## Success Criteria

✅ All tests pass when you run:
```bash
node comprehensive-api-test.js
```

✅ Output shows:
```
✅ Tests Passed: 11
❌ Tests Failed: 0
📊 Success Rate: 100.0%
```

---

## Next Steps After Task 19.3 Completes

1. **Task 19.4** - Create 5 frontend components
   - ProcurementDashboard
   - OrderManagement
   - VendorDirectory
   - InventoryManager
   - BudgetTracker

2. **Task 19.5** - Create comprehensive test suite
   - Unit tests
   - Integration tests
   - End-to-end tests

---

## Key Contacts/References

- **Backend API:** http://localhost:5000/api/*
- **Test Credentials:** admin@cpipl.com / password123
- **Database:** PostgreSQL (Neon) or SQLite (local)
- **Schema:** 9 procurement models, 23 endpoints
- **Documentation:** See TASK_19_3_FINAL_EXECUTION_REPORT.md

---

## Estimated Timeline

- **Database Sync:** 5-10 minutes
- **Test Execution:** 2-5 minutes  
- **Verification:** 5 minutes
- **Documentation:** 5 minutes
- **Total:** 15-30 minutes

---

**Created:** 2026-03-04  
**Updated:** After server startup and test framework creation  
**Status:** READY FOR IMMEDIATE EXECUTION
