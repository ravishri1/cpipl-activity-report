# Asset Repair System - Comprehensive Test Plan

## Status: READY FOR TESTING

**Created:** March 4, 2026  
**System:** Asset Repair/Maintenance Timeline  
**Version:** Phase 2 Frontend Integration Test

---

## Test Scope

### Components Under Test
1. **Backend API Endpoints** (8 endpoints)
   - POST `/assets/repairs/:assetId/initiate` - Initiate repair
   - GET `/assets/repairs/:assetId` - Get active repair
   - GET `/assets/repairs` - List all repairs (admin)
   - PUT `/assets/repairs/:repairId/update-status` - Update status
   - GET `/assets/repairs/overdue` - List overdue repairs
   - POST `/assets/repairs/:repairId/complete` - Complete repair
   - GET `/assets/repairs/:assetId/timeline` - Get timeline
   - PUT `/assets/repairs/:repairId/edit` - Edit repair details

2. **Frontend Components**
   - `AssetRepairTimeline.jsx` (604 lines) - Main repair management page
   - `repairHelpers.js` (359 lines) - Utility functions
   - `AssetManager.jsx` "In Repair" tab
   - Route: `/my-repairs`

3. **Database Models**
   - `AssetRepair` model with full lifecycle tracking
   - `RepairTimeline` model for audit trail
   - User relations (initiator, completer)

---

## Test Execution Plan

### Phase 1: Setup Verification
- [ ] Database schema verified (AssetRepair, RepairTimeline models exist)
- [ ] Prisma migration applied (`npx prisma db push`)
- [ ] All npm dependencies installed
- [ ] Backend server starts without errors
- [ ] Frontend server builds without errors

### Phase 2: Backend API Testing

#### 2.1 Test: Initiate Repair
```bash
POST /api/assets/1/repairs/initiate
Headers: Authorization: Bearer <admin-token>
Body: {
  "repairType": "maintenance",
  "expectedReturnDate": "2026-03-15",
  "vendor": "TechCare Services",
  "vendorLocation": "Bangalore",
  "vendorPhone": "9876543210",
  "vendorEmail": "info@techcare.com",
  "issueDescription": "Keyboard keys stuck",
  "estimatedCost": "500"
}
Expected: 201 Created, repair object with status='initiated'
```
- [ ] Status code 201
- [ ] Return repair object with ID
- [ ] Asset status changed to 'maintenance'
- [ ] RepairTimeline entry created

#### 2.2 Test: Get Active Repair
```bash
GET /api/assets/1/repairs
Headers: Authorization: Bearer <token>
Expected: 200 OK, repair object with latest repair
```
- [ ] Returns active repair for asset
- [ ] Includes initiator and completer info
- [ ] Returns 404 if no active repair

#### 2.3 Test: List All Repairs (Admin)
```bash
GET /api/assets/repairs?status=initiated&overdue=false
Headers: Authorization: Bearer <admin-token>
Expected: 200 OK, array of repairs
```
- [ ] Returns all repairs with filters
- [ ] Status code 200
- [ ] Properly applies filters (status, assetId, overdue)
- [ ] Includes asset, initiator, completer info
- [ ] Non-admin gets 403 Forbidden

#### 2.4 Test: Update Repair Status
```bash
PUT /api/assets/repairs/1/update-status
Headers: Authorization: Bearer <admin-token>
Body: {
  "newStatus": "in_progress",
  "notes": "Work started at vendor facility"
}
Expected: 200 OK, updated repair object
```
- [ ] Status transitions work (initiated → in_transit → in_progress → ready_for_pickup → completed)
- [ ] RepairTimeline entry created for each transition
- [ ] Returns updated repair object
- [ ] Validates new status is valid

#### 2.5 Test: Get Overdue Repairs
```bash
GET /api/assets/repairs/overdue
Headers: Authorization: Bearer <admin-token>
Expected: 200 OK, array of overdue repairs
```
- [ ] Returns only repairs past expected return date
- [ ] Excludes completed repairs
- [ ] Includes daysOverdue calculation
- [ ] Sorted by expectedReturnDate ascending

#### 2.6 Test: Complete Repair
```bash
POST /api/assets/repairs/1/complete
Headers: Authorization: Bearer <admin-token>
Body: {
  "actualReturnDate": "2026-03-14",
  "actualCost": "450"
}
Expected: 200 OK, completion message
```
- [ ] Repair status changed to 'completed'
- [ ] Asset status changed back to 'available'
- [ ] RepairTimeline entry created
- [ ] AssetHandover record created
- [ ] Cannot complete repair without actualReturnDate

#### 2.7 Test: Get Repair Timeline
```bash
GET /api/assets/1/repairs/timeline
Headers: Authorization: Bearer <token>
Expected: 200 OK, array of repairs with timelines
```
- [ ] Returns all repairs for asset
- [ ] Each repair includes timeline array
- [ ] Timeline sorted chronologically

#### 2.8 Test: Edit Repair Details
```bash
PUT /api/assets/repairs/1/edit
Headers: Authorization: Bearer <admin-token>
Body: {
  "vendor": "Updated Vendor",
  "estimatedCost": "600",
  "notes": "Escalated priority"
}
Expected: 200 OK, updated repair object
```
- [ ] Can update vendor details
- [ ] Can update dates (future only)
- [ ] Cannot edit completed repairs
- [ ] Returns updated repair object

### Phase 3: Frontend Component Testing

#### 3.1 Test: AssetRepairTimeline Component
- [ ] Page loads without errors
- [ ] All repairs load and display
- [ ] Loading spinner shows while fetching
- [ ] Error messages display correctly
- [ ] Empty state shows when no repairs
- [ ] Repairs grouped and sorted by urgency

#### 3.2 Test: Expand/Collapse Repairs
- [ ] Click expand → shows full repair details
- [ ] Click collapse → hides details
- [ ] Only one repair expanded at a time
- [ ] Details panel shows vendor info, dates, costs

#### 3.3 Test: Status Updates
- [ ] Click status update button
- [ ] Modal shows valid next statuses
- [ ] Can add notes to status change
- [ ] Submit → updates display
- [ ] Cancel → closes without updating
- [ ] Success message shows

#### 3.4 Test: Edit Repair Details
- [ ] Click edit button → enables editable fields
- [ ] Can edit vendor, phone, email, location
- [ ] Can edit expected return date
- [ ] Can edit estimated cost
- [ ] Save → sends PUT request, updates display
- [ ] Cancel → reverts changes
- [ ] Validation shows errors

#### 3.5 Test: Complete Repair
- [ ] Click complete button
- [ ] Modal shows actualReturnDate picker
- [ ] Default date is today
- [ ] Submit → calls complete endpoint
- [ ] Repair status changes to 'completed'
- [ ] Success message displays
- [ ] Repair moves to completed section

### Phase 4: Integration Testing

#### 4.1 Test: AssetManager Integration
- [ ] AssetManager "In Repair" tab shows assets in maintenance
- [ ] "Send for Repair" button on each asset
- [ ] Click button → repair modal opens
- [ ] Form validates inputs
- [ ] Submit → asset moves to maintenance status
- [ ] Asset appears in repair list

#### 4.2 Test: Full Repair Workflow
1. Create asset (status: available)
2. Assign to employee (status: assigned)
3. Send for repair (status: maintenance)
   - Set repair type, dates, vendor
   - Create AssetRepair record
4. Update status through workflow
   - initiated → in_transit → in_progress → ready_for_pickup
5. Complete repair
   - Asset returns to available
   - AssetHandover created
   - RepairTimeline has full history

#### 4.3 Test: Overdue Detection
- [ ] Create repair with expected return date in past
- [ ] Repair appears in "Overdue" section
- [ ] Urgency indicator shows "critical" (red)
- [ ] Days overdue calculated correctly
- [ ] Alert shown when viewing overdue repairs

#### 4.4 Test: Access Control
- [ ] Admin can: initiate repair, update status, edit details, complete repair, view all repairs
- [ ] Employee can: view own repairs history via `/my-repairs`
- [ ] Non-admin cannot: initiate repair, update status, complete repair
- [ ] Employee cannot: view other employees' repairs

### Phase 5: UI/UX Testing

#### 5.1 Test: Responsiveness
- [ ] Page displays correctly on desktop (1920px)
- [ ] Page displays correctly on tablet (768px)
- [ ] Page displays correctly on mobile (375px)
- [ ] All buttons and inputs accessible

#### 5.2 Test: Visual Feedback
- [ ] Urgency colors display correctly
  - Red for critical (> 14 days overdue)
  - Orange for high (7-14 days overdue)
  - Yellow for medium (0-7 days overdue)
  - Green for low (on track)
- [ ] Status badges display with correct colors
- [ ] Loading spinners animate
- [ ] Error messages stand out
- [ ] Success messages auto-dismiss

#### 5.3 Test: Data Validation
- [ ] Cannot initiate repair without required fields
- [ ] Cannot set expected return date in past
- [ ] Cannot complete repair without actual return date
- [ ] Cannot update to invalid status
- [ ] Phone/email fields validate format
- [ ] Cost fields accept only numbers

---

## Test Data Setup

### Prerequisites
```sql
-- Ensure test asset exists and is assigned
SELECT id, name, status FROM Asset WHERE id = 1;

-- Expected output:
-- id: 1
-- name: "Dell Latitude 5540"
-- status: "assigned"
```

### Test Repairs to Create
1. **Initiated Repair**
   - Asset: Dell Laptop (id: 1)
   - Type: maintenance
   - Expected return: 2026-03-15
   - Status: initiated

2. **In Progress Repair**
   - Asset: Monitor (id: 2)
   - Type: repair
   - Expected return: 2026-03-12
   - Status: in_progress

3. **Overdue Repair**
   - Asset: Keyboard (id: 3)
   - Type: maintenance
   - Expected return: 2026-02-28 (PAST)
   - Status: in_progress

4. **Completed Repair**
   - Asset: Mouse (id: 4)
   - Type: inspection
   - Expected return: 2026-03-05
   - Actual return: 2026-03-04
   - Status: completed

---

## Expected Results Summary

### Backend
- ✅ All 8 endpoints implemented
- ✅ Database models properly defined
- ✅ Relationships correct (Asset → AssetRepair → RepairTimeline)
- ✅ Status transitions validated
- ✅ Overdue detection working
- ✅ Access control enforced

### Frontend
- ✅ AssetRepairTimeline component loads
- ✅ repairHelpers utilities available
- ✅ All CRUD operations functional
- ✅ Status updates work end-to-end
- ✅ Overdue urgency calculated correctly
- ✅ UI displays properly on all sizes

### Integration
- ✅ AssetManager "In Repair" tab works
- ✅ Send for repair workflow complete
- ✅ Asset status transitions properly
- ✅ Repair history tracked
- ✅ Access control enforced

---

## Test Execution Results

### Execution Date: _______________
### Executed By: _______________

### Phase 1: Setup Verification
- [ ] Database verified
- [ ] Migrations applied
- [ ] Dependencies installed
- [ ] Servers start
- [ ] Build succeeds
**Status:** _______________

### Phase 2: Backend API Testing
- [ ] Initiate repair: _______________
- [ ] Get active repair: _______________
- [ ] List all repairs: _______________
- [ ] Update status: _______________
- [ ] Get overdue: _______________
- [ ] Complete repair: _______________
- [ ] Get timeline: _______________
- [ ] Edit details: _______________
**Status:** _______________

### Phase 3: Frontend Component Testing
- [ ] AssetRepairTimeline loads: _______________
- [ ] Expand/collapse: _______________
- [ ] Status updates: _______________
- [ ] Edit details: _______________
- [ ] Complete repair: _______________
**Status:** _______________

### Phase 4: Integration Testing
- [ ] AssetManager integration: _______________
- [ ] Full workflow: _______________
- [ ] Overdue detection: _______________
- [ ] Access control: _______________
**Status:** _______________

### Phase 5: UI/UX Testing
- [ ] Responsiveness: _______________
- [ ] Visual feedback: _______________
- [ ] Data validation: _______________
**Status:** _______________

---

## Known Issues / Notes

(To be filled during testing)

---

## Sign-Off

**Tested By:** _______________  
**Date:** _______________  
**Status:** ⬜ PENDING | 🟡 IN PROGRESS | 🟢 PASSED | 🔴 FAILED

---

**Test Plan Version:** 1.0  
**Last Updated:** March 4, 2026
