# PHASE 4: DATA TRANSFORMATION & IMPORT EXECUTION GUIDE

**Date:** March 4, 2026  
**Status:** READY FOR EXECUTION  
**Modules:** 4 (Employee, Leave, Asset, Org Structure)  
**Total Data Volume:** 158 records across 4 modules

---

## 📋 OVERVIEW

Phase 4 consists of two sequential sub-phases:

| Phase | Name | Task | Status |
|-------|------|------|--------|
| **4.1** | Data Transformation | Convert CSV exports to normalized JSON | ✅ Scripts Ready |
| **4.2** | Data Import | Import transformed data into CPIPL DB | 📋 Next |
| **4.3** | Verification | Validate imported data integrity | 📋 Next |

---

## 🚀 PHASE 4.1: DATA TRANSFORMATION

### Overview
The transformation phase reads exported CSV files and converts them to normalized JSON matching the CPIPL schema. Each transformation script:
- ✅ Reads the CSV export file
- ✅ Validates each record
- ✅ Transforms to CPIPL format
- ✅ Calculates data quality metrics
- ✅ Outputs normalized JSON with metadata

### Transformation Scripts Created

| Script | Input | Output | Records |
|--------|-------|--------|---------|
| `transform-employee-data.js` | employee-master-data-export.csv | employee-master-transformed.json | 41 |
| `transform-leave-data.js` | leave-config-export.csv | leave-config-transformed.json | 72 |
| `transform-asset-data.js` | asset-register-export.csv | asset-register-transformed.json | 4 |
| `transform-org-structure.js` | org-structure-export.csv | org-structure-transformed.json | 41 |

### Execution Instructions

#### **Option 1: Run Master Script (RECOMMENDED)**

```bash
# Navigate to server directory
cd "D:\Activity Report Software\server"

# Run master transformation script
node scripts/phase4-execute.js
```

This single command:
- Executes all 4 transformation scripts in sequence
- Validates each output
- Generates consolidated transformation report
- Provides status summary and next steps

#### **Option 2: Run Individual Scripts**

If you need to run specific transformations:

```bash
cd "D:\Activity Report Software\server"

# Transform employee data
node scripts/transform-employee-data.js

# Transform leave data
node scripts/transform-leave-data.js

# Transform asset data
node scripts/transform-asset-data.js

# Transform organization structure
node scripts/transform-org-structure.js
```

### Expected Output

After running `phase4-execute.js`, you should see:

```
============================================================
📊 PHASE 4: TRANSFORMATION EXECUTION REPORT
============================================================

✅ Employee Master Data
   Status: READY FOR IMPORT
   Records: 41/41 valid (100% quality)
   Expected: 41 records
   ✓ Match confirmed

✅ Leave Configuration
   Status: READY FOR IMPORT
   Records: 72/72 valid (100% quality)
   Expected: 72 records
   ✓ Match confirmed

✅ Asset Register
   Status: READY FOR IMPORT
   Records: 4/4 valid (100% quality)
   Expected: 4 records
   ✓ Match confirmed

✅ Organizational Structure
   Status: READY FOR IMPORT
   Records: 41/41 valid (100% quality)
   Expected: 41 records
   ✓ Match confirmed

============================================================
📈 OVERALL STATISTICS
============================================================

Total Records Transformed: 158/158
Overall Quality Score: 100.0%

✅ ALL MODULES READY FOR IMPORT
```

### Output Files

All transformed data is saved in: `server/imports/`

| File | Size | Purpose |
|------|------|---------|
| `employee-master-transformed.json` | ~12 KB | 41 employee records |
| `leave-config-transformed.json` | ~8 KB | 72 leave balance records |
| `asset-register-transformed.json` | ~4 KB | 4 asset records |
| `org-structure-transformed.json` | ~10 KB | 41 org hierarchy records |
| `PHASE4_TRANSFORMATION_REPORT.json` | ~2 KB | Consolidated metadata report |

### Data Quality Validation

Each transformation validates:
- ✅ Required fields present
- ✅ Data types correct
- ✅ Date formats normalized (YYYY-MM-DD)
- ✅ Numeric values valid
- ✅ Relationships intact

**Quality Threshold:** ≥90% of records must be valid to proceed to import

---

## 🗂️ PHASE 4.2: DATA IMPORT (UPCOMING)

### Prerequisites
- ✅ Phase 4.1 transformations completed
- ✅ All JSON files in `server/imports/`
- ✅ CPIPL database running
- ✅ Prisma migrations current

### Import Strategy

**Step 1: Employee Master Data** (41 records)
```javascript
// Import creates new User records with complete profile data
POST /api/import/employees
```

**Step 2: Organizational Structure** (41 records)
```javascript
// Sets reporting manager relationships
POST /api/import/org-structure
```

**Step 3: Leave Configuration** (72 records)
```javascript
// Creates leave balances for each employee
POST /api/import/leave
```

**Step 4: Asset Register** (4 records)
```javascript
// Creates asset assignments
POST /api/import/assets
```

**Step 5: Skip Payroll**
```
// No payroll data to import (0 records in source)
```

### Import Rollback Strategy

If import fails at any stage:
1. Delete imported records from affected table
2. Review error logs
3. Fix transformed data if needed
4. Re-run import for that module only

---

## ✅ PHASE 4.3: POST-IMPORT VERIFICATION (UPCOMING)

After all imports complete, verify:

```javascript
// Check record counts
SELECT COUNT(*) FROM User;              // Should be 41+
SELECT COUNT(*) FROM LeaveBalance;      // Should be 72+
SELECT COUNT(*) FROM Asset;             // Should be 4+

// Verify relationships
SELECT * FROM User WHERE reportingManagerId IS NOT NULL;
SELECT * FROM Asset WHERE assignedTo IS NOT NULL;

// Data integrity
SELECT COUNT(*) FROM User WHERE email IS NULL OR email = '';
SELECT COUNT(*) FROM LeaveBalance WHERE balance < 0;
```

---

## 📊 TRANSFORMATION SCRIPTS DETAILED BEHAVIOR

### Employee Transformation
**Input:** 41 employee records with complete profile data  
**Processing:**
- Normalizes dates (DOB, DOJ, confirmation, probation end)
- Validates designation & department present
- Formats phone/email fields
- Preserves family, education, employment history
- Maps role to enum: admin, team_lead, member

**Output:** Complete employee profile ready for User creation

### Leave Transformation
**Input:** 72 leave balance records across multiple years  
**Processing:**
- Groups by employee + leave type + year
- Validates numeric balances
- Calculates carry forward totals
- Maps leave types

**Output:** Leave balance records ready for bulk insert

### Asset Transformation
**Input:** 4 asset records with assignment details  
**Processing:**
- Normalizes dates (purchase, assignment)
- Validates prices as decimal
- Maps condition & status enums
- Preserves warranty information

**Output:** Asset records ready for assignment creation

### Org Structure Transformation
**Input:** 41 employee records with hierarchy details  
**Processing:**
- Maps reporting manager by employee ID
- Validates department assignments
- Calculates subordinate counts
- Normalizes designation data

**Output:** Org hierarchy ready for relationship linking

---

## 🛠️ TROUBLESHOOTING

### Issue: CSV file not found
**Solution:** Ensure Phase 3 exports completed and files exist in `server/exports/`

### Issue: Transformation produces 0 valid records
**Solution:** Check CSV column names match expected headers. Verify quotes/escaping in CSV.

### Issue: Quality score < 90%
**Solution:** Review error log in transformation output. Fix data in source CSV. Re-run transformation.

### Issue: Missing required field errors
**Solution:** Check mandatory field presence in source CSV. Update export script if schema changed.

---

## 📈 SUCCESS METRICS

Transformation is successful when:
- ✅ All 4 modules transform without errors
- ✅ Overall quality score ≥ 90%
- ✅ Record counts match expectations
- ✅ All JSON files created in `server/imports/`
- ✅ No validation errors in output

**Current Status:** ✅ READY FOR EXECUTION

---

## ⏱️ TIMING

| Task | Est. Duration | Actual |
|------|---------------|--------|
| Transform employee data | 5 sec | — |
| Transform leave data | 3 sec | — |
| Transform asset data | 2 sec | — |
| Transform org structure | 3 sec | — |
| **Total** | **~15 sec** | — |

---

## 📝 MANUAL EXECUTION CHECKLIST

Before running transformations:

- [ ] Phase 3 exports completed
- [ ] CSV files present in `server/exports/`
- [ ] Node.js in PATH
- [ ] npm dependencies installed
- [ ] `server/imports/` directory exists
- [ ] CPIPL database accessible

After transformations complete:

- [ ] All JSON files created
- [ ] PHASE4_TRANSFORMATION_REPORT.json exists
- [ ] Overall quality ≥ 90%
- [ ] All record counts match expected
- [ ] No critical errors in output

---

## 🚀 READY TO PROCEED

**Phase 4.1 (Transformation) is ready to execute.**

Run this command to begin:

```bash
cd "D:\Activity Report Software\server" && node scripts/phase4-execute.js
```

---

**Created:** March 4, 2026  
**Phase Status:** READY FOR EXECUTION  
**Next:** Phase 4.1 Data Transformation
