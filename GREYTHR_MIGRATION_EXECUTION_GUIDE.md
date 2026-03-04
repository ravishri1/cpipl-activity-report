# greytHR to CPIPL Migration - Phase 3 Execution Guide

**Status:** Ready for manual execution  
**Date:** March 4, 2026  
**Priority:** 5 data exports required before Phase 4 begins

---

## Overview

This guide provides step-by-step instructions for executing Phase 3 of the greytHR-to-CPIPL migration. Phase 3 focuses on exporting critical data from greytHR that will be transformed and imported into the CPIPL system.

### Phase 3 Deliverables
1. ✅ Transformation scripts created (4 scripts: 2,123 lines total)
2. 📋 Data exports required (5 priority data sets)
3. 📊 Schema mapping complete (761 lines documented)
4. 🔄 Ready for data transformation and import

---

## Quick Start

### Option 1: Automated Export via Node.js Script (Recommended)

**Windows Command Prompt:**
```batch
cd "D:\Activity Report Software\server"
node scripts/export-employee-master-data.js
```

**PowerShell:**
```powershell
cd 'D:\Activity Report Software\server'
node scripts/export-employee-master-data.js
```

**Output:** `D:\Activity Report Software\server\exports\employee-master-data-export.csv`

---

## Manual Export Instructions (If Automated Script Fails)

### Prerequisites
- Administrator access to greytHR system
- Access to CPIPL application (admin credentials)
- CSV export capability in greytHR
- Approximately 1 hour for complete Phase 3

---

## Phase 3 Data Exports

### 1. Employee Master Data Export (PRIORITY 1)

**What to Export:** 56 active employees  
**Fields Required:** 37 core fields  
**Format:** CSV  
**Estimated Time:** 15 minutes

**Manual Steps in greytHR:**
1. Navigate to Employee Master → Reports → Employee Directory
2. Filter for "Active" employees only
3. Select all 56 records
4. Export as CSV with all following fields:
   - Employee ID / Emp Code
   - Employee Name / Full Name
   - Email / Official Email
   - Phone Number / Mobile Number
   - Personal Email
   - Designation / Job Title
   - Department
   - Employment Type
   - Employment Status
   - Date of Joining
   - Confirmation Date
   - Probation End Date
   - Notice Period
   - Previous Experience
   - Location / Office Location
   - Grade / Pay Grade
   - Role
   - Date of Birth
   - Gender
   - Marital Status
   - Blood Group
   - Nationality
   - Father's Name
   - Spouse Name
   - Religion
   - Place of Birth
   - Current Address
   - Permanent Address
   - Aadhaar Number
   - PAN Number
   - Passport Number
   - Passport Expiry
   - Driving License
   - Bank Name
   - Bank Account Number
   - Bank Branch
   - IFSC Code
   - UAN Number

5. Save as: `employee-master-data-export.csv`

**Automated Alternative:**
```bash
node "D:\Activity Report Software\server\scripts\export-employee-master-data.js"
```

---

### 2. Payroll Configuration Export (PRIORITY 2)

**What to Export:** Salary structures and components  
**Estimated Time:** 20 minutes

**Manual Steps in greytHR:**
1. Navigate to Payroll → Salary Structure Master
2. Export all active salary structures
3. Include:
   - Structure ID / Name
   - Company
   - Grade / Level
   - Effective Date
   - Base Salary
   - Dearness Allowance (DA)
   - House Rent Allowance (HRA)
   - Conveyance Allowance
   - Medical Allowance
   - Other Allowances (detail each)
   - Standard Deductions (PF, ESI, TDS, etc.)
   - Net Salary Formula

4. Save as: `payroll-structure-export.csv`

5. Separately export:
   - Salary Components Master: `salary-components-export.csv`
   - Pay Grades: `pay-grades-export.csv`
   - Deduction Rules: `deduction-rules-export.csv`

---

### 3. Leave Configuration Export (PRIORITY 3)

**What to Export:** Leave types, rules, and employee balances  
**Estimated Time:** 15 minutes

**Manual Steps in greytHR:**
1. Navigate to Leave → Configuration
2. Export Leave Types:
   - Name
   - Code
   - Applicable To
   - Maximum Days Per Year
   - Can Carryforward
   - Max Carryforward Days
   - Requires Approval
   - Approval Level
   
3. Save as: `leave-types-export.csv`

4. Export Leave Rules/Policies:
   - Applied to (Department/Grade/etc.)
   - Leave Type
   - Annual Limit
   - Accrual Method
   - Accrual Period
   - Vesting Rules
   
5. Save as: `leave-rules-export.csv`

6. Export Historical Leave Data for current FY:
   - Employee Name / ID
   - Leave Type
   - Opening Balance
   - Accrued
   - Used
   - Closing Balance
   - Last Updated Date
   
7. Save as: `leave-balances-export.csv`

---

### 4. Asset Register Export (PRIORITY 4)

**What to Export:** 54 fixed assets with allocation details  
**Estimated Time:** 10 minutes

**Manual Steps in greytHR:**
1. Navigate to Assets → Asset Register
2. Filter for Active assets only (54 total)
3. Export with fields:
   - Asset ID / Serial Number
   - Asset Category
   - Asset Name
   - Asset Description
   - Cost / Purchase Price
   - Purchase Date
   - Depreciation Method
   - Useful Life (Years)
   - Current Book Value
   - Assigned To (Employee ID / Name)
   - Allocation Date
   - Location
   - Condition (Good/Fair/Poor)
   - Maintenance Status
   - Warranty End Date
   - Remarks

4. Save as: `asset-register-export.csv`

---

### 5. Organizational Structure Export (PRIORITY 5)

**What to Export:** Reporting hierarchy and organizational chart  
**Estimated Time:** 10 minutes

**Manual Steps in greytHR:**
1. Navigate to Organization → Org Structure
2. Export Reporting Hierarchy:
   - Employee ID
   - Employee Name
   - Designation
   - Department
   - Reporting To (Manager Name)
   - Manager ID
   - Manager Designation
   - Manager Department

3. Save as: `org-structure-export.csv`

4. Export Department Structure:
   - Department ID / Code
   - Department Name
   - Department Head (Name / ID)
   - Parent Department
   - Budget Code
   - Cost Center

5. Save as: `department-structure-export.csv`

---

## Data Transformation (Phase 3 - Part B)

After exporting all 5 data sets, transform them using the pre-built Node.js scripts:

### 1. Transform Employee Data
```bash
cd "D:\Activity Report Software\server"
node src/transformEmployeeData.js --source employee-master-data-export.csv --output employee-transformed.json
```

### 2. Transform Payroll Data
```bash
node src/transformPayrollData.js --source payroll-structure-export.csv --output payroll-transformed.json
```

### 3. Transform Leave Data
```bash
node src/transformLeaveData.js --source leave-types-export.csv,leave-rules-export.csv,leave-balances-export.csv --output leave-transformed.json
```

### 4. Transform Asset Data
```bash
node src/transformAssetData.js --source asset-register-export.csv --output asset-transformed.json
```

---

## Data Validation (Phase 3 - Part C)

After transformation, validate data integrity:

```bash
node scripts/validate-migration-data.js --source employee-transformed.json,payroll-transformed.json,leave-transformed.json,asset-transformed.json
```

**Expected Output:**
- Total records per data set
- Data quality score (target: >95%)
- Missing critical fields
- Invalid value patterns
- Duplicate detection

---

## Import Phase (Phase 4 - Prerequisite)

Once Phase 3 data exports and transformations are complete:

1. **Navigate to CPIPL:**
   - Login as admin@cpipl.com
   - Go to Admin → Data Import

2. **Execute Bulk Import:**
   ```
   - Upload: employee-transformed.json
   - Upload: payroll-transformed.json
   - Upload: leave-transformed.json
   - Upload: asset-transformed.json
   - Click "Import All"
   ```

3. **Verify Import Results:**
   - Check employee count (target: 56)
   - Verify reporting hierarchy
   - Confirm payroll structures loaded
   - Validate leave balances

---

## File Locations

### Export Files Location
```
D:\Activity Report Software\server\exports\
├── employee-master-data-export.csv
├── payroll-structure-export.csv
├── leave-types-export.csv
├── leave-rules-export.csv
├── asset-register-export.csv
└── org-structure-export.csv
```

### Transformed Files Location
```
D:\Activity Report Software\server\transformed\
├── employee-transformed.json
├── payroll-transformed.json
├── leave-transformed.json
└── asset-transformed.json
```

### Transformation Scripts Location
```
D:\Activity Report Software\server\src\
├── transformEmployeeData.js (321 lines)
├── transformPayrollData.js (635 lines)
├── transformLeaveData.js (765 lines)
└── transformAssetData.js (763 lines)
```

---

## Troubleshooting

### Export Issues

**Issue:** "Employee count doesn't match (expected 56, got N)"  
**Solution:** Verify filter is set to "Active" employees only in greytHR

**Issue:** "Missing critical fields in CSV"  
**Solution:** Re-export with all fields selected, do not customize column selection

**Issue:** "Date format incorrect"  
**Solution:** Ensure greytHR exports dates in YYYY-MM-DD format (check export settings)

### Transformation Issues

**Issue:** "Node script not found or won't execute"  
**Solution:** Ensure you're in the server directory and Node.js is in PATH
```bash
node --version  # Should show v14+ or higher
npm --version   # Should show v6+ or higher
```

**Issue:** "JSON parse error in transformation"  
**Solution:** Verify CSV file has no special characters; re-export with UTF-8 encoding

### Import Issues

**Issue:** "Import fails with duplicate key error"  
**Solution:** Check for duplicate employee IDs in exported data; clean before re-importing

**Issue:** "Some records fail to import"  
**Solution:** Review error log in CPIPL admin panel, fix data quality issues, re-import

---

## Timeline Estimate

- **Export Phase:** 60-90 minutes total
  - Employee data: 15 min
  - Payroll config: 20 min
  - Leave config: 15 min
  - Assets: 10 min
  - Org structure: 10 min
  
- **Transformation Phase:** 10-15 minutes (automatic)
- **Validation Phase:** 5-10 minutes (automatic)
- **Import Phase:** 20-30 minutes (Phase 4)

**Total: 2-2.5 hours for complete Phase 3-4 execution**

---

## Checkpoints

### Pre-Export Checklist
- [ ] greytHR system is accessible and up-to-date
- [ ] CPIPL system is running and admin-accessible
- [ ] 5 GB free disk space available
- [ ] Node.js v14+ installed
- [ ] All transformation scripts copied to server
- [ ] Database backup created

### Post-Export Checklist
- [ ] All 5 CSV files generated (1+ GB total)
- [ ] Files contain expected record counts
- [ ] CSV format validated (comma-separated, UTF-8)
- [ ] No data truncation noticed
- [ ] Files backed up to secure location

### Post-Transform Checklist
- [ ] All 4 JSON files generated
- [ ] Validation report shows >95% quality
- [ ] No critical field warnings
- [ ] Reporting hierarchy intact
- [ ] Date formats consistent

### Pre-Import Checklist
- [ ] Transformed files uploaded to CPIPL
- [ ] Import preview shows correct counts
- [ ] No duplicate key conflicts
- [ ] All required relationships valid
- [ ] Test import on staging (if available)

---

## Next Steps

1. **Execute Phase 3 Exports:**
   - Use automated script or manual greytHR export
   - Save all 5 CSV files to exports directory

2. **Verify Export Quality:**
   - Check record counts match expected values
   - Spot-check 5-10 records for data completeness

3. **Run Transformation Scripts:**
   - Execute transform commands in sequence
   - Verify output JSON files generated

4. **Run Validation:**
   - Ensure data quality score >95%
   - Review and resolve any warnings

5. **Proceed to Phase 4:**
   - Begin import process
   - Monitor import progress
   - Verify all records imported successfully

---

## Support & Documentation

- **Schema Mapping:** `D:\Activity Report Software\GREYTHR_TO_CPIPL_SCHEMA_MAPPING.md`
- **Transformation Guide:** `D:\Activity Report Software\TRANSFORMATION_SCRIPTS_GUIDE.md`
- **Migration Plan:** `D:\Activity Report Software\GREYTHR_MIGRATION_PHASE3_PLAN.md`
- **System Status:** `D:\Activity Report Software\PROJECT_STATUS_MARCH_2026.md`

---

## Questions?

If you encounter any issues:
1. Check the troubleshooting section above
2. Review system logs in CPIPL admin panel
3. Verify data file integrity (run file validation)
4. Contact system administrator if needed

---

**Document Version:** 1.0  
**Last Updated:** March 4, 2026  
**Phase:** Phase 3 (Data Export & Transformation) Ready for Execution
