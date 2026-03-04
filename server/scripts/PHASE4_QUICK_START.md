# Phase 4 Quick Start Guide

## Overview

Phase 4 is the data transformation, import, and verification phase of the greytHR-to-CPIPL migration.

**Data Being Imported:**
- 41 employee master records
- 72 leave balance records  
- 4 asset records
- 41 organizational structure records
- **Total: 158 records**

**Phases:**
- **Phase 4.0:** Pre-flight validation (optional but recommended)
- **Phase 4.1:** Data transformation (CSV → JSON)
- **Phase 4.2:** Database import (JSON → Database)
- **Phase 4.3:** Data verification (validation checks)

---

## Quick Start (30 minutes)

### Step 1: Pre-Flight Check (5 min)

First, verify everything is ready:

```bash
cd D:\Activity Report Software\server
node scripts/phase4-preflight.js
```

**Expected Output:**
- ✅ All checks passed
- CSV files found (4 files)
- Scripts found (7 files)
- Database connected
- Environment variables set

If any checks fail, see **Troubleshooting** section below.

---

### Step 2: Run Complete Workflow (20 min)

Execute all three phases together:

```bash
cd D:\Activity Report Software\server
node scripts/phase4-runner.js
```

**What Happens:**
1. Transformation: Converts 4 CSV files → 4 JSON files
2. Import: Loads JSON data into database
3. Verification: Validates all imported data

**Expected Duration:** 15-20 seconds total

**Expected Output:**
```
====================================================================
🚀 PHASE 4 EXECUTION RUNNER
====================================================================

Phase 4.1: Data Transformation
--------------------------------------------------------------------
✅ employee-master-data-export.csv → 41 records (quality: 100%)
✅ leave-config-export.csv → 72 records (quality: 100%)
✅ asset-register-export.csv → 4 records (quality: 100%)
✅ org-structure-export.csv → 41 records (quality: 100%)
✅ Phase 4.1 completed in 3.45s

Phase 4.2: Data Import
--------------------------------------------------------------------
✅ Importing 41 employees... Imported: 41, Failed: 0
✅ Updating org structure... Updated: 41
✅ Importing 72 leave balances... Imported: 72, Failed: 0
✅ Importing 4 assets... Imported: 4, Failed: 0
✅ Phase 4.2 completed in 4.23s

Phase 4.3: Data Verification
--------------------------------------------------------------------
✅ Employee data: 41 records, 0 issues (PASS)
✅ Org structure: 41 records, 0 orphaned, 0 circular (PASS)
✅ Leave data: 72 records, 0 issues (PASS)
✅ Asset data: 4 records, 0 issues (PASS)
✅ Relationships: 0 orphaned, 0 conflicts (PASS)
✅ Phase 4.3 completed in 2.15s

📊 EXECUTION SUMMARY
====================================================================
Total Duration: 9.83s
Phases Executed: 3/3
Status: ✅ ALL PASSED

📋 NEXT STEPS
====================================================================
✅ Phase 4.1 (Transformation) completed
✅ Phase 4.2 (Import) completed  
✅ Phase 4.3 (Verification) completed

📋 ALL PHASES COMPLETED - BEGIN PHASE 5:
1. Review PHASE4_VERIFICATION_REPORT.json for any issues
2. Create greytHR-to-CPIPL final integration mapping document
3. Update CPIPL system configuration for feature parity
4. Perform end-to-end testing with stakeholders
5. Obtain sign-off and approval for go-live
```

---

### Step 3: Review Reports (5 min)

After successful execution, review the generated reports:

```bash
# View consolidated report
cat server/scripts/reports/PHASE4_CONSOLIDATED_REPORT.json

# View transformation details
cat server/scripts/reports/PHASE4_TRANSFORMATION_REPORT.json

# View import details
cat server/scripts/reports/PHASE4_IMPORT_REPORT.json

# View verification results
cat server/scripts/reports/PHASE4_VERIFICATION_REPORT.json
```

---

## Individual Phase Execution

If you need to run phases separately:

### Phase 4.1: Transformation Only

```bash
cd D:\Activity Report Software\server
node scripts/phase4-execute.js
```

**Output:** `PHASE4_TRANSFORMATION_REPORT.json`  
**Time:** ~3-5 seconds

### Phase 4.2: Import Only

```bash
cd D:\Activity Report Software\server
node scripts/phase4-import.js
```

**Input:** `PHASE4_TRANSFORMATION_REPORT.json` (from Phase 4.1)  
**Output:** `PHASE4_IMPORT_REPORT.json`  
**Time:** ~4-6 seconds

### Phase 4.3: Verification Only

```bash
cd D:\Activity Report Software\server
node scripts/phase4-verify.js
```

**Output:** `PHASE4_VERIFICATION_REPORT.json`  
**Time:** ~2-3 seconds

---

## File Locations

```
D:\Activity Report Software\server\
├── scripts/
│   ├── phase4-runner.js              ← Master orchestration script
│   ├── phase4-preflight.js           ← Pre-flight validation
│   ├── phase4-execute.js             ← Phase 4.1 (transformation)
│   ├── phase4-import.js              ← Phase 4.2 (import)
│   ├── phase4-verify.js              ← Phase 4.3 (verification)
│   ├── transform-employee-data.js    ← Employee transformation
│   ├── transform-leave-data.js       ← Leave transformation
│   ├── transform-asset-data.js       ← Asset transformation
│   ├── transform-org-structure.js    ← Org structure transformation
│   ├── imports/                       ← CSV export files (input)
│   │   ├── employee-master-data-export.csv
│   │   ├── leave-config-export.csv
│   │   ├── asset-register-export.csv
│   │   └── org-structure-export.csv
│   └── reports/                       ← Generated reports (output)
│       ├── PHASE4_TRANSFORMATION_REPORT.json
│       ├── PHASE4_IMPORT_REPORT.json
│       ├── PHASE4_VERIFICATION_REPORT.json
│       └── PHASE4_CONSOLIDATED_REPORT.json
```

---

## Troubleshooting

### Error: "CSV file not found"

**Cause:** Phase 3 export files not in `scripts/imports/` directory

**Solution:**
```bash
# Check what files exist
dir D:\Activity Report Software\server\scripts\imports\

# If missing, you need to re-export from greytHR system
# OR verify Phase 3 exports were saved correctly
```

### Error: "Database connection failed"

**Cause:** SQLite database not accessible or connection string invalid

**Solution:**
```bash
# Check database file exists
ls D:\Activity Report Software\server\prisma\dev.db

# Verify DATABASE_URL in .env
cat D:\Activity Report Software\server\.env

# Should look like:
# DATABASE_URL="file:./prisma/dev.db"
```

### Error: "Duplicate key error" during import

**Cause:** Employee email or other unique field already exists in database

**Solution:**
```bash
# Option 1: Clear employees before re-import
# In Prisma Studio (below), delete duplicate records

# Option 2: Use --force flag (creates new instances)
node scripts/phase4-import.js --force
```

### Error: "Quality check failed" in transformation

**Cause:** CSV data has <90% valid records

**Solution:**
- Verify CSV files are valid (not corrupted)
- Check transformation report for specific issues
- Review greytHR export settings

### Error: "Verification failed" after import

**Cause:** Imported data has integrity issues

**Solution:**
```bash
# View detailed verification report
cat server/scripts/reports/PHASE4_VERIFICATION_REPORT.json

# Look for "problems" array with specific issues
# Common issues:
# - Orphaned records (employee deleted, leave balance remains)
# - Invalid manager references
# - Duplicate emails

# Manually fix issues in Prisma Studio, then re-run Phase 4.3
```

---

## Advanced Options

### Skip Preflight Check

If you know everything is ready:

```bash
node scripts/phase4-runner.js --skip-preflight
```

### Run Single Phase

If Phase 4.1 succeeded but Phase 4.2 failed:

```bash
# Retry just Phase 4.2
node scripts/phase4-runner.js --phase=4.2
```

### Validate Setup Without Running

```bash
node scripts/phase4-preflight.js
```

This runs all checks but doesn't execute any transformations or imports.

---

## Data Quality Standards

Phase 4 enforces **≥90% data quality** for each module:

| Module | Records | Quality Check |
|--------|---------|---|
| **Employees** | 41 | Required: email, name, designation, department |
| **Leave** | 72 | Required: employee link, leave type, balance ≥ 0 |
| **Assets** | 4 | Required: asset ID, name, type, status |
| **Org Structure** | 41 | Required: employee link, designation, dept |

If any module falls below 90%, transformation **fails with detailed error report**.

---

## What Gets Imported

### Employee Master Data (41 records)

Fields imported:
- Basic info: name, email, phone, designation, department
- Employment: joining date, type, status, employee ID
- Personal: DOB, gender, address, marital status
- Documents: Aadhar, PAN, bank account, phone number
- Education: highest qualification, college, percentage, year
- Family members: names, relationships
- Previous employment: companies, roles, durations

### Leave Configuration (72 records)

Fields imported:
- Employee link
- Leave type (Casual, Earned, Sick, Optional, etc.)
- Year
- Total allocated
- Total used
- Current balance
- Carry forward balance

### Asset Register (4 records)

Fields imported:
- Asset ID, name, type, category
- Serial number, purchase date, price
- Condition (new/good/fair/poor)
- Status (available/assigned/maintenance)
- Assigned to employee (if applicable)

### Organizational Structure (41 records)

Fields imported:
- Employee ID
- Designation
- Department
- Reporting manager link
- Subordinate count
- Grade/Level

---

## Post-Import Tasks

After Phase 4 completes successfully:

1. **Verify in UI:** Log in to CPIPL and check:
   - Employee directory has all 41 employees
   - Leave balances are correct
   - Assets are assigned correctly
   - Org chart shows reporting structure

2. **Run Reports:** Generate CPIPL reports to verify data:
   - Headcount by department (should be 16 departments)
   - Leave balances report
   - Asset inventory report
   - Org structure visualization

3. **Check Integrations:** Verify greytHR features now work:
   - Attendance system recognizes all employees
   - Leave requests use correct balances
   - Payroll can be set up with salary structures
   - Onboarding/separation workflows active

---

## Phase 5 Next Steps

After Phase 4 completes:

1. **Review reports** for any data quality issues
2. **Create final integration document** mapping all greytHR fields to CPIPL
3. **Configure CPIPL system** for feature parity (policies, workflows, etc.)
4. **End-to-end testing** with stakeholders
5. **Go-live approval** and sign-off

---

## Contact & Support

If Phase 4 fails or you need help:

1. Check `PHASE4_CONSOLIDATED_REPORT.json` for detailed error info
2. Review troubleshooting section above
3. Verify all Phase 3 CSV exports exist in `scripts/imports/`
4. Check database connectivity via Prisma Studio
5. Review individual phase reports for specific module errors

---

## Summary

**Quick Command:**
```bash
cd D:\Activity Report Software\server
node scripts/phase4-preflight.js      # Validate (5 min)
node scripts/phase4-runner.js         # Execute (20 min)
```

**Expected Result:** 158 records imported into CPIPL with zero data integrity issues ✅

---

*Last Updated: March 4, 2026*  
*Phase 4 Status: READY FOR EXECUTION*
