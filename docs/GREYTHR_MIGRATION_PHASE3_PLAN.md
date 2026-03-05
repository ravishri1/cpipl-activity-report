# greytHR-to-CPIPL Migration - Phase 3+ Execution Plan

**Date:** March 4, 2026  
**Current Status:** Phase 2 (Transformation Scripts) ✅ COMPLETE  
**Next Status:** Phase 3 (Data Exports) - **READY TO BEGIN**

---

## Overview

This document outlines the execution plan for Phases 3-5 of the greytHR-to-CPIPL data migration. The transformation infrastructure is complete; this phase focuses on data extraction and application.

### Phase Breakdown

| Phase | Name | Status | Focus |
|-------|------|--------|-------|
| 1 | Analysis & Mapping | ✅ Complete | Schema design, module exploration |
| 2 | Transformation Scripts | ✅ Complete | Node.js transformation code |
| 3 | Data Exports | ⏳ Ready to Start | Extract from greytHR |
| 4 | Data Import | 📋 Pending | Apply to CPIPL system |
| 5 | Validation & Testing | 📋 Pending | Verify integrity & completeness |

---

## Phase 3: Data Exports

### Objective
Export all employee data from greytHR system in CSV format, ready for transformation and import.

### Data Sets to Export

#### 3.1: Employee Master Data (Priority 1)
**What:** Core employee information (56 active employees)
**Status:** Ready for export
**Source:** greytHR → Employee module

**Fields to Extract:**
- Employee ID / Employee Code
- Name (First, Last, Display)
- Email (Personal, Company)
- Phone (Personal, Company)
- Date of Birth
- Gender
- Marital Status
- Address (Current, Permanent)
- City, State, Postal Code
- Country
- PAN (Tax ID)
- Aadhaar / National ID
- Bank Account
- IFSC Code
- Salary Account
- Father's Name
- Joining Date
- Department
- Designation
- Reporting Manager
- Location (Miraroad, Lucknow)
- Employment Type (Full-time, Contract, etc.)
- Status (Active, Separated, On Leave)
- Company (CPIPL)

**Export Steps:**
1. Login to greytHR with admin credentials
2. Navigate to: **Setup > Employee Master**
3. Apply filters: Status = Active
4. Select all employees (or use bulk export option)
5. Click **Export to Excel/CSV**
6. Save as: `GreytHR_EmployeeMaster_[DATE].csv`
7. Verify all 56 employees are included

**Validation Checklist:**
- [ ] All 56 employees present
- [ ] No duplicate records
- [ ] Email addresses valid
- [ ] All required fields populated
- [ ] Phone numbers formatted correctly
- [ ] Dates in consistent format (YYYY-MM-DD)
- [ ] No special characters causing encoding issues

---

#### 3.2: Payroll Configuration (Priority 2)
**What:** Salary structures, components, and pay schedules
**Status:** Ready for export
**Source:** greytHR → Payroll module

**Salary Structure Data:**
- Structure Name (e.g., "CPIPL - Standard 2026")
- Components (Basic, HRA, DA, Conveyance, etc.)
- Component Type (Earnings, Deductions, Other)
- Amount (Fixed or Formula-based)
- Tax Impact (Taxable/Non-taxable)
- Effective From/To Dates
- Pay Grade Mapping
- Department Mapping

**Export Steps:**
1. Login to greytHR
2. Navigate to: **Setup > Salary Structures**
3. Click **Export**
4. Select all active structures
5. Save as: `GreytHR_SalaryStructures_[DATE].csv`

**Additional Exports:**
- Payroll Components (earnings, deductions, taxes)
- Pay Schedules (monthly, bi-weekly, etc.)
- Holiday Master (applicable pay cycles)
- Bonus/Incentive structures

**Validation Checklist:**
- [ ] All active structures exported
- [ ] Components list complete
- [ ] Amounts/formulas preserved
- [ ] Tax codes mapped correctly
- [ ] Effective dates consistent

---

#### 3.3: Leave Configuration & History (Priority 3)
**What:** Leave types, balances, and historical leave records
**Status:** Ready for export
**Source:** greytHR → Leave module

**Leave Type Master:**
- Leave Type Name (Casual, Sick, Earned, etc.)
- Leave Code
- Days Per Year
- Carryover Rules
- Encashment Allowed (Yes/No)
- Purpose/Description

**Leave Balances (Current):**
- Employee ID
- Leave Type
- Opening Balance (Jan 2026)
- Accrued This Year
- Available Balance
- Used This Year
- Pending Approval

**Leave History (Past 2 Years):**
- Employee ID
- Leave Type
- From Date
- To Date
- Duration (days)
- Status (Approved, Pending, Rejected)
- Approval Date
- Remarks

**Export Steps:**
1. Login to greytHR
2. Navigate to: **Leave > Leave Type Master**
3. Export all leave types to CSV
4. Navigate to: **Leave > Balances**
5. Export all current balances to CSV
6. Navigate to: **Leave > History**
7. Filter by date range (2024-2026)
8. Export all leave records to CSV
9. Save as:
   - `GreytHR_LeaveTypes_[DATE].csv`
   - `GreytHR_LeaveBalances_[DATE].csv`
   - `GreytHR_LeaveHistory_[DATE].csv`

**Validation Checklist:**
- [ ] All leave types exported
- [ ] Balances match employee records
- [ ] Historical records include all leaves (2+ years)
- [ ] Status values consistent (approved, pending, etc)
- [ ] Dates chronologically valid

---

#### 3.4: Asset Register (Priority 4)
**What:** Asset master data including allocation and history
**Status:** Ready for export
**Source:** greytHR → Assets module OR external asset tracking system

**Asset Data (54 total assets):**
- Asset ID / Asset Tag
- Asset Name
- Asset Type (Laptop, Desktop, Phone, etc.)
- Serial Number
- Model/Specification
- Purchase Date
- Purchase Price
- Warranty Expiry Date
- Current Status (Available, Assigned, Maintenance)
- Assigned To (Employee ID if assigned)
- Assignment Date
- Location (Miraroad, Lucknow)
- Category (Personal, Office, Infrastructure)
- Condition (New, Good, Fair, Damaged)
- Notes/Remarks

**Asset History (Handover Records):**
- Asset ID
- From Employee
- To Employee
- Handover Date
- Return Date
- Condition at Handover
- Signature/Approval

**Export Steps:**
1. Navigate to asset tracking system (may be external)
2. Generate report: **Asset Master**
3. Include filters:
   - Date range: 2024-2026
   - Status: All (Active + Historical)
4. Export to CSV: `GreytHR_Assets_[DATE].csv`
5. Generate report: **Asset Handover History**
6. Export to CSV: `GreytHR_AssetHistory_[DATE].csv`

**Validation Checklist:**
- [ ] All 54 assets exported
- [ ] Serial numbers verified
- [ ] Assignments match employee records
- [ ] Handover history complete
- [ ] No asset orphaned (unassigned indefinitely)

---

#### 3.5: Organizational Structure (Priority 5)
**What:** Department hierarchy, reporting structure, and roles
**Status:** Ready for export
**Source:** greytHR → Organization Setup

**Department Master:**
- Department ID
- Department Name
- Parent Department (for hierarchy)
- Department Head (Employee ID)
- Cost Center
- Location
- Active Status

**Reporting Hierarchy:**
- Employee ID
- Employee Name
- Designation
- Department
- Manager ID (Employee ID of manager)
- Manager Name
- Reporting Level (1=CEO, 2=Director, etc.)

**Designation Master:**
- Designation ID
- Designation Name
- Department
- Level/Grade
- Role Category

**Export Steps:**
1. Navigate to: **Setup > Organization**
2. Export department structure: `GreytHR_Departments_[DATE].csv`
3. Navigate to: **Reports > Organizational Chart**
4. Export reporting structure: `GreytHR_ReportingStructure_[DATE].csv`
5. Navigate to: **Setup > Designations**
6. Export designations: `GreytHR_Designations_[DATE].csv`

**Validation Checklist:**
- [ ] All departments exported
- [ ] Hierarchy relationships correct (parent-child valid)
- [ ] All managers have entries
- [ ] No circular reporting (manager reports to subordinate)
- [ ] All designations assigned to employees

---

## Export File Naming Convention

All exported files should follow this naming pattern:

```
GreytHR_[DataType]_[YYYY-MM-DD].csv
```

**Examples:**
- `GreytHR_EmployeeMaster_2026-03-04.csv`
- `GreytHR_SalaryStructures_2026-03-04.csv`
- `GreytHR_LeaveTypes_2026-03-04.csv`
- `GreytHR_LeaveHistory_2026-03-04.csv`
- `GreytHR_Assets_2026-03-04.csv`
- `GreytHR_Departments_2026-03-04.csv`

**Storage Location:**
- Create folder: `D:\Activity Report Software\greythr-exports\`
- Store all CSV files here for easy access during import phase

---

## Data Quality Checks

After exporting each data set, perform these checks:

### Check 1: Row Count Verification
```
Expected vs Actual:
- Employees: 56 expected
- Assets: 54 expected
- Departments: ~10 expected
- Leave Types: ~8-10 expected
- Salary Structures: ~3-5 expected
```

### Check 2: Encoding Issues
- Open each CSV in notepad
- Verify no garbled characters (especially in Indian names, addresses)
- If issues found, re-export with UTF-8 encoding

### Check 3: Delimiter Validation
- Open in Excel to verify proper column alignment
- Check that fields with commas are properly quoted
- Verify date formats are consistent

### Check 4: Foreign Key Integrity
- Employee IDs referenced in asset assignments exist
- Manager IDs referenced in reporting structure exist
- All lookups (Department, Designation) match their masters

### Check 5: No Sensitive Data Leakage
- Verify no passwords exported
- Verify no API keys in export
- Verify no SSN/Aadhaar exported (unless needed for import)

---

## Transformation Scripts Status

All transformation scripts are **ready and tested**:

| Script | Location | Status | Input | Output |
|--------|----------|--------|-------|--------|
| Employee Transformer | `scripts/transform-employees.js` | ✅ Complete (321 lines) | CSV → JSON | CPIPL format |
| Payroll Transformer | `scripts/transform-payroll.js` | ✅ Complete (635 lines) | CSV → JSON | CPIPL format |
| Leave Transformer | `scripts/transform-leaves.js` | ✅ Complete (765 lines) | CSV → JSON | CPIPL format |
| Asset Transformer | `scripts/transform-assets.js` | ✅ Complete (763 lines) | CSV → JSON | CPIPL format |

**Usage Pattern:**
```bash
cd "D:\Activity Report Software\scripts"
node transform-employees.js ../greythr-exports/GreytHR_EmployeeMaster_2026-03-04.csv
# Outputs: ../greythr-exports/CPIPL_Employees_2026-03-04.json
```

---

## Timeline Estimate

| Task | Duration | Depends On |
|------|----------|-----------|
| Export Employee Data | 30 min | greytHR access |
| Export Payroll Config | 30 min | greytHR access |
| Export Leave Data | 45 min | greytHR access |
| Export Asset Data | 30 min | Asset system access |
| Export Org Structure | 30 min | greytHR access |
| **Subtotal Exports** | **2.5 hours** | - |
| Transform Employee Data | 15 min | Export complete |
| Transform Payroll Data | 15 min | Export complete |
| Transform Leave Data | 15 min | Export complete |
| Transform Asset Data | 15 min | Export complete |
| **Subtotal Transforms** | **1 hour** | Exports complete |
| **PHASE 3 TOTAL** | **3.5 hours** | - |

---

## Success Criteria

Phase 3 is **COMPLETE** when:
- ✅ All 5 data sets successfully exported from greytHR
- ✅ All CSV files pass quality checks
- ✅ All transformation scripts execute without errors
- ✅ Output JSON files are validated (correct structure, no duplicates)
- ✅ Files ready for Phase 4 (Import)

---

## What NOT to Do

❌ **DO NOT** export the following (not needed for CPIPL):
- Attendance records older than 6 months
- Temporary/draft payslips
- Deleted/archived employees
- Inactive vendors or contractors
- Personal leave notes or sensitive comments

❌ **DO NOT** modify exported data manually
- Let transformation scripts handle all conversions
- Manual edits introduce errors and inconsistencies
- If correction needed, fix in greytHR and re-export

❌ **DO NOT** skip validation steps
- Quality checks catch issues before import
- Bad data imported = bad state in production
- Validation is quick, import fix is expensive

---

## Phase 4 Preview (Import)

Once Phase 3 data exports are complete and validated:

**Phase 4 will execute:**
1. Load transformed JSON files
2. Create employee records in CPIPL
3. Initialize payroll structures
4. Setup leave balances
5. Register assets in system
6. Establish organizational hierarchy
7. Create all necessary relationships

**Phase 4 will use:**
- Backend API endpoints for bulk import
- Validation and error checking
- Rollback capability if issues detected
- Detailed import logs for audit trail

---

## Contact & Support

If issues encountered during export:

1. **greytHR Access Issues:**
   - Contact greytHR support or admin
   - Verify user has "Export" permission
   - Check if export feature is enabled in system

2. **Data Quality Issues:**
   - Contact greytHR support
   - May need to clean data in greytHR first
   - Re-export after cleanup

3. **Transformation Script Issues:**
   - Check Node.js version: `node --version` (should be 16+)
   - Check file format: ensure CSV not Excel (.xlsx)
   - Check file encoding: must be UTF-8

---

## Checklist for Phase 3 Completion

### Export Tasks
- [ ] Employee Master Data exported (56 records)
- [ ] Payroll Configuration exported
- [ ] Leave Type Master exported
- [ ] Leave Balances (Current) exported
- [ ] Leave History (2+ years) exported
- [ ] Asset Register exported (54 assets)
- [ ] Asset Handover History exported
- [ ] Organizational Structure exported
- [ ] All CSV files stored in `greythr-exports/` folder

### Quality Assurance
- [ ] Row counts verified for all exports
- [ ] Encoding checked (no garbled data)
- [ ] CSV format validated in Excel
- [ ] Foreign key integrity confirmed
- [ ] No sensitive data leakage
- [ ] File names follow convention
- [ ] Backup of greytHR data created

### Transformation
- [ ] All transformation scripts installed
- [ ] Employee transform executed and validated
- [ ] Payroll transform executed and validated
- [ ] Leave transform executed and validated
- [ ] Asset transform executed and validated
- [ ] Output JSON files reviewed
- [ ] No duplicates in output data

### Documentation
- [ ] Export report created (records count, dates)
- [ ] Data quality report created
- [ ] Transformation log reviewed
- [ ] This checklist completed

---

## Summary

✅ **Phase 3 Status:** Ready to execute
- All source systems identified
- Export procedures documented
- Transformation infrastructure ready
- Quality checks defined
- Success criteria established

⏳ **Next Step:** Execute data exports from greytHR
📋 **Then:** Validate and transform exported data
🚀 **Finally:** Import to CPIPL system (Phase 4)

---

**Last Updated:** March 4, 2026  
**Prepared By:** Claude Agent  
**Status:** Ready for Phase 3 Execution

