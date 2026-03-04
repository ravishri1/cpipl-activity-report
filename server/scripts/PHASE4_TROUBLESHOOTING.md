# Phase 4 Troubleshooting & Recovery Guide

## Common Issues & Solutions

---

## 🔴 Critical Issues

### Issue 1: "Cannot find module 'csv-parse'"

**Error Message:**
```
Error: Cannot find module 'csv-parse'
```

**Cause:** Missing Node.js package for CSV parsing

**Solution:**
```bash
cd D:\Activity Report Software\server
npm install csv-parse
```

**Verification:**
```bash
node -e "require('csv-parse')" && echo "✅ csv-parse installed"
```

---

### Issue 2: "DATABASE_URL not set"

**Error Message:**
```
Error: DATABASE_URL environment variable not set
```

**Cause:** `.env` file missing or empty

**Solution:**
```bash
# Create .env file in server directory
cat > D:\Activity Report Software\server\.env << EOF
DATABASE_URL="file:./prisma/dev.db"
NODE_ENV=development
SKIP_ENV_VALIDATION_FOR_SCRIPTS=true
EOF
```

**Verification:**
```bash
cat D:\Activity Report Software\server\.env
```

---

### Issue 3: "Cannot connect to database"

**Error Message:**
```
PrismaClientInitializationError: Can't reach database server
```

**Cause:** SQLite database file corrupted or missing

**Solution:**
```bash
# Check if database file exists
ls -la D:\Activity Report Software\server\prisma\dev.db

# If missing, regenerate from schema
cd D:\Activity Report Software\server
npx prisma db push

# If corrupted, reset and recreate
rm D:\Activity Report Software\server\prisma\dev.db
npx prisma db push
```

**Verification:**
```bash
npx prisma studio  # Opens web UI - should load without errors
```

---

## 🟡 Import Issues

### Issue 4: "Duplicate key value violates unique constraint"

**Error Message:**
```
P2002: Unique constraint failed on the fields: (`email`)
Employee with email admin@cpipl.com already exists
```

**Cause:** Employee already exists in database from seed data or previous import

**Solution - Option A: Skip Duplicates (Recommended)**
```bash
# Edit phase4-import.js line 45, add duplicate check:
const existing = await prisma.user.findUnique({
  where: { email: emp.email }
});

if (existing) {
  console.log(`Skipping duplicate: ${emp.email}`);
  continue;
}
```

**Solution - Option B: Delete Existing Records**
```bash
# Using Prisma Studio (interactive)
npx prisma studio

# Navigate to User table, delete non-admin test users
# Then re-run import

# Or via script:
cd D:\Activity Report Software
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.user.deleteMany({
    where: { role: 'member', email: { contains: '@cpipl.com' } }
  });
  console.log('Deleted test members');
})();
"
```

**Prevention:**
- Import from clean database
- Or modify transform scripts to set `skipExisting: true`

---

### Issue 5: "Foreign key constraint failed on User.reportingManagerId"

**Error Message:**
```
P2003: Foreign key constraint failed on the fields: (`reportingManagerId`)
Cannot set reportingManagerId for employee because manager doesn't exist
```

**Cause:** Org structure trying to link to non-existent reporting manager

**Solution:**
```bash
# Verify manager exists before linking
# Edit transform-org-structure.js, add this check:

const manager = await prisma.user.findUnique({
  where: { employeeId: org.reportingManagerId },
  select: { id: true }
});

if (!manager) {
  console.warn(`Manager ${org.reportingManagerId} not found, skipping link`);
  org.reportingManagerId = null;
}
```

---

### Issue 6: "Leave type does not exist"

**Error Message:**
```
Error: Leave type 'Casual Leave' not found in system
Create leave type first before importing balances
```

**Cause:** Imported leave types don't match CPIPL leave types

**Solution - Option A: Auto-Create Missing Types**

The `phase4-import.js` script automatically creates missing leave types. If this fails:

```bash
# Manually create leave types
npx prisma studio

# Go to LeaveType table, create:
# - Casual Leave
# - Earned Leave
# - Sick Leave
# - Optional Holiday
# - Unpaid Leave
# - Maternity/Paternity Leave

# Then re-run import
```

**Solution - Option B: Modify Transform to Match**

Edit `transform-leave-data.js` to map greytHR leave types to CPIPL:
```js
const leaveTypeMap = {
  'Casual': 'Casual Leave',
  'EL': 'Earned Leave',
  'SL': 'Sick Leave',
  'Optional': 'Optional Holiday'
};

// Use map[row['Leave Type']] instead of raw value
```

---

## 🟡 Data Quality Issues

### Issue 7: "Quality check failed - only 85% records valid"

**Error Message:**
```
❌ Quality Check Failed: 85% valid (need ≥90%)
Invalid records: 6
```

**Cause:** CSV data has invalid or missing required fields

**Solution:**

1. **Check transformation report:**
```bash
cat server/scripts/reports/PHASE4_TRANSFORMATION_REPORT.json | grep -A 20 "invalid"
```

2. **Identify specific problems:**
```json
{
  "invalid_records": [
    { "row": 5, "error": "Missing email", "data": { "name": "John", ... } },
    { "row": 12, "error": "Invalid date format", "data": { "dateOfJoining": "13/05/2022" } }
  ]
}
```

3. **Fix in CSV and re-export from greytHR:**
   - Fix data quality issues in source system
   - Re-export CSV files
   - Re-run Phase 4.1

4. **Or modify transformation script to be more lenient:**
```js
// In transform-employee-data.js, add defaults:
function transformEmployeeRecord(row) {
  return {
    email: row['Official Email']?.trim() || `emp-${Date.now()}@cpipl.com`, // Default email
    name: row['Employee Name']?.trim() || 'Unknown',
    // ... rest of fields with fallback values
  };
}
```

---

### Issue 8: "Balance validation failed - used > allocated"

**Error Message:**
```
❌ Leave Validation Failed
Employee COLOR001: Used leave (15) > Allocated (10)
This would create negative balance
```

**Cause:** Leave data inconsistent in source system

**Solution:**

1. **Validate data in Prisma Studio:**
```bash
npx prisma studio

# Check LeaveBalance table for this employee
# Compare: totalAllocated vs totalUsed
```

2. **Fix in transformation script:**
```js
// In transform-leave-data.js, add correction:
function transformLeaveRecord(row) {
  const allocated = parseFloat(row['Total Allocated']) || 0;
  const used = parseFloat(row['Total Used']) || 0;
  
  // If used > allocated, cap at allocated
  const correctedUsed = Math.min(used, allocated);
  
  return {
    // ...
    totalAllocated: allocated,
    totalUsed: correctedUsed,
    balance: Math.max(allocated - correctedUsed, 0)
  };
}
```

3. **Or skip problematic records:**
```js
if (used > allocated) {
  console.warn(`Skipping ${row['Employee ID']}: invalid leave balance`);
  return null; // Skip this record
}
```

---

## 🟡 Verification Failures

### Issue 9: "Verification failed: 3 orphaned leave records"

**Error Message:**
```
❌ Data Relationships: FAILED
Orphaned leave records: 3
Leave balances exist for non-existent employees: [EMP001, EMP002, EMP003]
```

**Cause:** Leave records reference employees that don't exist in database

**Solution:**

1. **View orphaned records:**
```bash
npx prisma studio

# Go to LeaveBalance table
# Manually check: Each record should have a valid `userId`
```

2. **Delete orphaned records:**
```bash
# Using Prisma
cd D:\Activity Report Software
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const deleted = await prisma.leaveBalance.deleteMany({
    where: {
      user: null  // Delete leave with no user
    }
  });
  console.log('Deleted ' + deleted.count + ' orphaned records');
})();
"
```

3. **Or re-order imports** to ensure employees exist first:
   - Phase 4.2 already handles this (employees → org → leaves → assets)
   - If still failing, check Phase 4.2 import logs

---

### Issue 10: "Circular reporting manager detected"

**Error Message:**
```
❌ Org Structure: FAILED
Circular reporting detected:
EMP001 → EMP002 → EMP003 → EMP001
```

**Cause:** Manager's manager is that person (creates loop)

**Solution:**

1. **Find and fix in database:**
```bash
npx prisma studio

# In User table, find employees with circular references
# Edit reportingManagerId to be NULL or different manager
```

2. **Validate hierarchy:**
```bash
cat server/scripts/reports/PHASE4_VERIFICATION_REPORT.json | grep -A 5 "circular"
```

3. **Prevent in transformation:**
```js
// In transform-org-structure.js
const managers = new Map(); // Track all manager IDs
for (const org of data) {
  if (org.reportingManagerId === org.employeeId) {
    console.warn(`Circular ref: ${org.employeeId} cannot manage themselves`);
    org.reportingManagerId = null;
  }
}
```

---

## 🟢 Partial Failures (Recoverable)

### Issue 11: "Phase 4.2 partial failure: 3/41 employees failed"

**Error Message:**
```
✅ Imported: 38/41 employees
❌ Failed: 3/41 employees

Failed records:
[{ employeeId: "EMP001", error: "Duplicate email: admin@cpipl.com" }]
```

**This is OK!** Phase 4 continues even with partial failures.

**Solution:**

1. **Review failed records:**
```bash
cat server/scripts/reports/PHASE4_IMPORT_REPORT.json | grep -A 30 "failed"
```

2. **Fix and reimport:**
   - Delete or update problematic records
   - Re-run Phase 4.2
   - Continue to Phase 4.3

---

## 🟢 Recovery Procedures

### Recovery Scenario 1: Phase 4.1 Succeeded, Phase 4.2 Failed

**Situation:** Transformation worked, import failed

**Recovery:**
```bash
# Option 1: Re-run just Phase 4.2
node scripts/phase4-runner.js --phase=4.2

# Option 2: Fix database issues and re-run
npx prisma studio        # Fix constraint violations
node scripts/phase4-import.js
```

---

### Recovery Scenario 2: Phase 4.2 Succeeded, Phase 4.3 Failed

**Situation:** Import worked, verification found issues

**Recovery:**
```bash
# Option 1: Re-run just Phase 4.3 (non-destructive)
node scripts/phase4-runner.js --phase=4.3

# Option 2: Fix data issues manually and re-run
npx prisma studio        # Edit records to fix issues
node scripts/phase4-verify.js

# Option 3: Delete imported data and start over
npx prisma migrate reset  # Warning: Deletes all data
npx prisma db push       # Recreates schema
node scripts/phase4-runner.js  # Re-run all phases
```

---

### Recovery Scenario 3: All Phases Failed (Start Over)

**Situation:** Need to clear everything and restart

**Full Reset:**
```bash
# 1. Clear database
cd D:\Activity Report Software\server
npx prisma migrate reset
npx prisma db push

# 2. Verify CSV export files exist
ls scripts/imports/

# 3. Re-run complete Phase 4
node scripts/phase4-preflight.js
node scripts/phase4-runner.js
```

---

## 📋 Debugging Checklist

When Phase 4 fails, check in this order:

- [ ] All 4 CSV files exist: `scripts/imports/`
  ```bash
  ls D:\Activity Report Software\server\scripts\imports\
  ```

- [ ] Database is accessible
  ```bash
  npx prisma studio
  ```

- [ ] Dependencies installed
  ```bash
  npm list csv-parse
  ```

- [ ] NODE_ENV not set to production
  ```bash
  echo $env:NODE_ENV  # Should be empty or "development"
  ```

- [ ] Database schema up to date
  ```bash
  npx prisma db push
  ```

- [ ] No file locking issues
  ```bash
  # Close Prisma Studio, any SQLite tools
  # Kill any other node processes
  ```

- [ ] Disk space available
  ```bash
  # At least 100MB free on C: drive
  ```

---

## 🔍 Debug Logging

To get more detailed logs during execution:

**Enable debug mode:**
```bash
# Before running scripts:
$env:DEBUG=* 

# Run script with verbose output:
node scripts/phase4-runner.js 2>&1 | tee phase4-debug.log
```

**This will capture all output to `phase4-debug.log`**

---

## 📞 Getting Help

If you're stuck:

1. **Check the reports:**
   - `PHASE4_CONSOLIDATED_REPORT.json` - Overall summary
   - `PHASE4_TRANSFORMATION_REPORT.json` - CSV→JSON conversion
   - `PHASE4_IMPORT_REPORT.json` - Import details
   - `PHASE4_VERIFICATION_REPORT.json` - Validation results

2. **Run preflight check:**
   ```bash
   node scripts/phase4-preflight.js > preflight-output.txt
   cat preflight-output.txt
   ```

3. **Enable verbose logging:**
   ```bash
   node scripts/phase4-runner.js --debug > full-output.txt 2>&1
   cat full-output.txt
   ```

4. **Check individual phase logs:**
   ```bash
   node scripts/transform-employee-data.js > emp-transform.log 2>&1
   cat emp-transform.log
   ```

---

## Common Success Patterns

### After Preflight, Phase 4 Should Take ~10 Seconds

```
Phase 4.1: Transformation ... 3-5s
Phase 4.2: Import ............ 4-6s  
Phase 4.3: Verification ...... 2-3s
Total ....................... ~10s
```

If it's taking much longer:
- Check if other processes are using SQLite
- Verify disk I/O isn't bottlenecked
- Check if large antivirus scans are running

---

## Quick Reference

| Problem | Quick Fix |
|---------|-----------|
| Missing CSV files | Check `scripts/imports/` directory |
| DB connection error | Run `npx prisma db push` |
| Duplicate key error | Delete existing test data, re-run |
| Leave type missing | Manually create in Prisma Studio |
| Verification fails | Check `PHASE4_VERIFICATION_REPORT.json` |
| Need to restart | Run `npx prisma migrate reset` then re-run |

---

*Last Updated: March 4, 2026*  
*Troubleshooting Guide: COMPLETE*
