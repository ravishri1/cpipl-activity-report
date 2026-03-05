# Task 19: HRMS/Procurement/Inventory Integration Design

**Date:** March 4, 2026  
**Status:** DESIGN PHASE IN PROGRESS  
**Task:** Design and implement HRMS/Procurement/Inventory integrations

---

## PHASE 1: INTEGRATION REQUIREMENTS ANALYSIS

### Current System State

**Existing Systems:**
1. **HRMS (Human Resource Management System)**
   - Employee profiles with personal/professional data
   - Payroll, leave, attendance tracking
   - Performance and engagement data
   - Document management

2. **Asset Lifecycle Management**
   - Asset creation and tracking
   - Asset handovers and repairs
   - Warranty management
   - Asset status tracking

3. **Procurement System** (TBD)
   - Purchase order management
   - Vendor management
   - Requisition tracking
   - Approval workflows

4. **Inventory Management System** (TBD)
   - Stock tracking
   - Item categorization
   - Storage location management
   - Stock movements

### Integration Gaps to Address

1. **Asset-Employee Linking**
   - Currently: Assets assigned to employees (one-to-many)
   - Need: Track which employees use which assets
   - Need: Historical asset-employee relationships

2. **Procurement to Asset Tracking**
   - Gap: No link between purchase orders and assets
   - Need: When item is purchased, create asset record
   - Need: Track procurement cost vs. book value

3. **Inventory to Asset Reconciliation**
   - Gap: Asset Lifecycle and Inventory are separate
   - Need: Sync inventory quantities with asset counts
   - Need: Update inventory when asset is retired

4. **Employee Data for Asset Assignment**
   - Currently: Assets can be assigned to users
   - Need: Department-based asset categories
   - Need: Asset assignment policies by department

5. **Financial Integration**
   - Gap: No connection to payroll for asset deductions
   - Need: Asset recovery from separation
   - Need: Depreciation tracking

---

## INTEGRATION ARCHITECTURE DESIGN

### 1. Data Model Enhancements

**New Models Needed:**

**ProcurementOrder**
```
id, orderNumber, vendorId, department, 
status, totalAmount, createdDate, deliveryDate,
approvedBy, createdBy, notes, attachments
```

**InventoryItem**
```
id, itemCode, name, category, unitPrice,
quantityOnHand, reorderLevel, storageLocation,
lastRestockDate, supplier, description
```

**AssetInventoryLink**
```
assetId, inventoryItemId, quantityReceived,
dateReceived, purchaseOrderId, cost
```

**ProcurementApprovalWorkflow**
```
procurementId, approverRole, requiredApprovals,
currentApprovalStatus, approvedBy, approvalDate
```

**EmployeeBudget**
```
employeeId, year, assetBudget, totalSpent,
remainingBudget, department
```

### 2. Integration Flows

#### Flow 1: Procurement to Asset Creation

```
User creates Purchase Order
    ↓
System validates budget (Employee/Department)
    ↓
PO sent for approval (Department Head → Manager)
    ↓
Approval workflow progresses
    ↓
PO Approved → Creates Inventory Item(s)
    ↓
On goods receipt → Creates Asset Record
    ↓
Asset assigned to Employee/Department
    ↓
Create AssetInventoryLink
```

#### Flow 2: Asset Assignment and Tracking

```
New Asset Created
    ↓
Asset available in inventory
    ↓
Manager requests asset for employee
    ↓
Asset assigned to Employee
    ↓
Update EmployeeBudget.totalSpent
    ↓
Track in AssetInventoryLink
    ↓
Generate asset assignment report
```

#### Flow 3: Asset Retirement and Inventory Update

```
Asset marked for retirement
    ↓
Deduct from Inventory (if applicable)
    ↓
Update EmployeeBudget
    ↓
Generate retirement report
    ↓
Archive in Asset History
    ↓
Sync to Inventory system
```

#### Flow 4: Asset Repair Impact on Inventory

```
Asset sent for repair
    ↓
Update asset status to "in_repair"
    ↓
Check if temporary replacement needed
    ↓
If replacement: request from inventory
    ↓
Update inventory quantities
    ↓
Return asset: restore original status
    ↓
Sync to inventory
```

---

## 3. API Integration Points

### New Endpoints Required

**Procurement Management:**
```
POST   /api/procurement/orders           - Create PO
GET    /api/procurement/orders           - List POs
GET    /api/procurement/orders/:id       - Get PO details
PUT    /api/procurement/orders/:id       - Update PO
DELETE /api/procurement/orders/:id       - Cancel PO
POST   /api/procurement/approve/:id      - Approve PO
POST   /api/procurement/receive/:id      - Mark as received
```

**Inventory Management:**
```
GET    /api/inventory/items              - List inventory
POST   /api/inventory/items              - Create item
GET    /api/inventory/items/:id          - Get item details
PUT    /api/inventory/items/:id          - Update item
GET    /api/inventory/locations          - List storage locations
PUT    /api/inventory/transfer/:id       - Transfer item
GET    /api/inventory/reorder-alerts     - Low stock alerts
```

**Asset-Procurement Integration:**
```
POST   /api/assets/from-procurement/:poId    - Create asset from PO
GET    /api/assets/procurement-history/:id   - Get procurement history
PUT    /api/assets/assign-budget/:assetId    - Deduct from budget
GET    /api/assets/department-budget/:dept   - Get department budget
GET    /api/assets/employee-assigned/:empId  - List assigned assets
```

**Reports:**
```
GET    /api/reports/asset-inventory       - Asset vs Inventory reconciliation
GET    /api/reports/procurement-status    - PO status report
GET    /api/reports/budget-utilization    - Budget usage report
GET    /api/reports/asset-cost            - Asset cost analysis
```

---

## 4. Integration Points with Existing Systems

### With Asset Lifecycle Module

**Current Asset Model:**
- Extend with `procurementOrderId` field
- Add `originalCost` from PO
- Add `assignmentHistory` tracking
- Add `budgetCategory` field

**New Functions:**
- Link asset to inventory on creation
- Update inventory when asset retired
- Track asset-employee relationship
- Calculate depreciation from purchase date

### With Employee Module

**Current User Model:**
- Add `departmentBudget` reference
- Track assigned assets
- Track asset assignment history

**New Features:**
- Show assets assigned to employee
- Show asset costs in employee profile
- Track asset replacement history

### With Payroll Module (Future)

**Asset Deductions:**
- Personal assets: calculate depreciation deduction
- Home office allowance based on assets
- Asset recovery on separation

---

## 5. Data Synchronization Strategy

### Real-time Sync Points
- When asset assigned: Update inventory quantity
- When asset retired: Update inventory quantity
- When PO approved: Create inventory item
- When asset received: Update inventory

### Batch Sync Points (Daily)
- Reconcile asset count vs inventory count
- Update low-stock alerts
- Generate depreciation reports
- Clean up orphaned records

### API Sync Format
```json
{
  "syncType": "asset-assignment",
  "timestamp": "2026-03-04T10:30:00Z",
  "data": {
    "assetId": "ASSET-001",
    "inventoryItemId": "INV-001",
    "quantity": 1,
    "action": "assigned",
    "details": {
      "assignedTo": "employee123",
      "assignmentDate": "2026-03-04",
      "cost": 25000
    }
  }
}
```

---

## 6. Implementation Roadmap

### Phase 1: Database & Core Models (2 days)
- [ ] Add Procurement Order model
- [ ] Add Inventory Item model
- [ ] Add AssetInventoryLink model
- [ ] Add EmployeeBudget model
- [ ] Create Prisma migration
- [ ] Create indexes for performance

### Phase 2: Procurement Module (3 days)
- [ ] Create procurement routes (6 endpoints)
- [ ] Implement PO approval workflow
- [ ] Add goods receipt functionality
- [ ] Create PO listing and filtering
- [ ] Add budget validation
- [ ] Create tests (10 test cases)

### Phase 3: Inventory Module (3 days)
- [ ] Create inventory routes (6 endpoints)
- [ ] Implement stock tracking
- [ ] Add reorder level alerts
- [ ] Create transfer functionality
- [ ] Add location management
- [ ] Create tests (10 test cases)

### Phase 4: Integration & Sync (2 days)
- [ ] Implement asset-to-inventory links
- [ ] Create synchronization logic
- [ ] Build reconciliation reports
- [ ] Add error handling for sync failures
- [ ] Test end-to-end workflows

### Phase 5: Frontend Components (2 days)
- [ ] Create Procurement Manager UI
- [ ] Create Inventory Manager UI
- [ ] Create Budget Dashboard
- [ ] Add integration visualizations
- [ ] Create reports

### Phase 6: Testing & Deployment (1 day)
- [ ] Full integration testing
- [ ] Performance testing
- [ ] Security review
- [ ] Production deployment guide

**Total Estimated Duration:** 13 days

---

## 7. Technical Specifications

### Database Schema Changes

**New Tables:**
- `ProcurementOrder` (12 fields)
- `InventoryItem` (10 fields)
- `AssetInventoryLink` (6 fields)
- `ProcurementApprovalWorkflow` (7 fields)
- `EmployeeBudget` (6 fields)
- `InventoryLocation` (5 fields)
- `InventoryMovement` (8 fields)

**Field Additions to Existing Tables:**
- Asset: procurementOrderId, originalCost, budgetCategory, inventoryItemId
- User: departmentBudget
- Employee: assetAssignments[]

**Total New Fields:** 57

### Indexes Required
- ProcurementOrder: status, createdDate, vendorId
- InventoryItem: itemCode, category, storageLocation
- AssetInventoryLink: assetId, inventoryItemId
- EmployeeBudget: employeeId, year

### Performance Considerations
- Batch operations for bulk imports
- Caching for frequently accessed items
- Pagination for large result sets
- Asynchronous sync operations

---

## 8. Security & Access Control

### Role-Based Access

**Admin:**
- Full access to all procurement and inventory
- Approve/reject POs
- Set budget limits

**Manager:**
- Approve POs for team
- View team assets
- Request assets for team members

**Team Lead:**
- Create POs for team
- View team budget
- Track team assets

**Member:**
- View assigned assets
- Request asset replacement
- Report asset issues

### Audit Trail
- Log all PO changes
- Track approvals with timestamps
- Record inventory movements
- Maintain procurement audit log

---

## 9. Error Handling & Validation

### Validation Rules

**Procurement Order:**
- Vendor must exist
- Amount must be > 0
- Budget must have sufficient balance
- Approvers must be valid users

**Inventory Item:**
- Item code must be unique
- Unit price must be > 0
- Category must be valid
- Reorder level < quantity

**Asset Assignment:**
- Employee must be active
- Asset must be available
- Department budget must allow
- Asset type must match policy

### Error Scenarios
- Insufficient budget: Reject PO
- Invalid inventory location: Return error
- Circular assignment: Prevent
- Negative quantities: Reject
- Orphaned records: Auto-cleanup

---

## 10. Reporting & Analytics

### Reports to Implement

1. **Procurement Status Report**
   - POs by status (pending, approved, received)
   - Approval cycle time
   - Vendor performance

2. **Inventory Reconciliation**
   - Asset count vs Inventory count
   - Discrepancies
   - Missing items

3. **Budget Utilization**
   - Department budget usage
   - Employee asset costs
   - Overspending alerts

4. **Asset Cost Analysis**
   - Cost per asset type
   - Depreciation tracking
   - ROI analysis

---

## Next Steps

**Phase 1 will focus on:**
1. Designing complete database schema
2. Creating all Prisma models
3. Setting up migration scripts
4. Creating model relationships

**This document serves as the design spec for Task 19 implementation.**

---

**Status:** Design Phase Complete  
**Ready for:** Implementation Phase  
**Next Action:** Create database models

