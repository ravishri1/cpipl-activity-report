# Asset Lifecycle Management System - Comprehensive Design

**Document:** Complete End-to-End Asset Management System Design  
**Date:** March 4, 2026  
**Status:** DESIGN PHASE - READY FOR IMPLEMENTATION APPROVAL  
**Scope:** Replace basic asset system with comprehensive lifecycle tracking

---

## 📋 System Overview

A complete asset lifecycle management system tracking every asset from **purchase → stock → assignment → usage → return → disposal**, with full audit trail and integrations with HRMS, Procurement, Inventory, and Financial systems.

### Asset Types Tracked
- ✅ IT Assets (laptops, phones, monitors, chargers, headsets, keyboards, webcams, etc.)
- ✅ Furniture (desks, chairs, cabinets, shelves, etc.)
- ✅ Infrastructure (AC units, servers, printers, scanners, etc.)
- ✅ Office Equipment (access cards, ID cards, coffee machines, etc.)
- ✅ Tools & Equipment (any other company-owned items)

---

## 📊 Database Schema Design

### New Models to Create

#### 1. **Vendor** (NEW)
Tracks equipment suppliers and vendors
```prisma
model Vendor {
  id                  Int       @id @default(autoincrement())
  name                String    @unique
  contactPerson       String?
  email               String?
  phone               String?
  address             String?
  city                String?
  country             String?
  gstNumber           String?   @unique
  paymentTerms        String?   // e.g., "Net 30", "Net 60"
  accountNumber       String?
  bankName            String?
  isActive            Boolean   @default(true)
  notes               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  purchaseOrders      PurchaseOrder[]
  assets              Asset[]
  
  @@index([isActive])
}
```

#### 2. **Location** (NEW)
Tracks physical locations where assets are stored/used
```prisma
model Location {
  id                  Int       @id @default(autoincrement())
  name                String    @unique
  type                String    // "office", "warehouse", "floor", "desk", "storeroom"
  building            String?
  floor               Int?
  room                String?
  capacity            Int?      // for warehouse locations
  address             String?
  notes               String?
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  assets              Asset[]
  movements           AssetMovement[]
  
  @@index([type])
  @@index([isActive])
}
```

#### 3. **Asset** (ENHANCED)
Core asset records
```prisma
model Asset {
  id                  Int       @id @default(autoincrement())
  assetTag            String    @unique
  category            String    // "laptop", "phone", "desk", "printer", etc.
  subCategory         String?   // "gaming laptop", "office chair", etc.
  brand               String?
  model               String?
  serialNumber        String?   @unique
  barcode             String?   @unique
  qrCode              String?
  
  // Purchase info
  purchaseDate        String?
  purchasePrice       Float?
  vendorId            Int?
  invoiceNumber       String?
  
  // Warranty & Maintenance
  warrantyExpiry      String?
  warrantyVendor      String?
  
  // Current status
  status              String    @default("in_stock") // in_stock, assigned, in_repair, in_custody, disposed
  currentLocationId   Int?
  assignedTo          Int?      // UserId
  assignedDate        String?
  
  // Condition tracking
  conditionNew        String?   // condition when purchased
  conditionCurrent    String?   // "new", "good", "fair", "damaged", "non_working"
  
  // Lifecycle tracking
  purchaseOrderId     Int?
  disposalDate        String?
  disposalMethod      String?   // "scrap", "resell", "donate", "reuse"
  depreciation        Float?    // calculated field
  
  companyId           Int?
  notes               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  // Relations
  vendor              Vendor?            @relation(fields: [vendorId], references: [id])
  currentLocation     Location?          @relation(fields: [currentLocationId], references: [id])
  assignee            User?              @relation("AssignedAssets", fields: [assignedTo], references: [id])
  purchaseOrder       PurchaseOrder?     @relation(fields: [purchaseOrderId], references: [id])
  assignments         AssetAssignment[]
  movements           AssetMovement[]
  repairs             AssetRepair[]
  conditionLogs       AssetConditionLog[]
  disposals           AssetDisposal[]
  detachmentRequests  AssetDetachmentRequest[]
  
  @@index([status])
  @@index([category])
  @@index([assignedTo])
  @@index([currentLocationId])
  @@index([vendorId])
}
```

#### 4. **PurchaseOrder** (NEW)
Links to procurement system
```prisma
model PurchaseOrder {
  id                  Int       @id @default(autoincrement())
  poNumber            String    @unique
  vendorId            Int
  orderDate           String
  expectedDeliveryDate String?
  actualDeliveryDate  String?
  totalAmount         Float
  grnNumber           String?   // Goods Received Note
  status              String    @default("pending") // pending, received, completed
  notes               String?
  createdBy           Int
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  vendor              Vendor    @relation(fields: [vendorId], references: [id])
  assets              Asset[]
  createdByUser       User      @relation("PurchaseOrderCreator", fields: [createdBy], references: [id])
  
  @@index([status])
  @@index([vendorId])
}
```

#### 5. **AssetAssignment** (ENHANCED/NEW)
Track who has which asset and when
```prisma
model AssetAssignment {
  id                  Int       @id @default(autoincrement())
  assetId             Int
  employeeId          Int
  assignedDate        String
  expectedReturnDate  String?
  actualReturnDate    String?
  conditionOnIssue    String?   // "new", "good", "fair", "damaged"
  conditionOnReturn   String?
  approvedBy          Int?      // HR approval
  handoverSignature   String?   // base64 or URL
  returnSignature     String?
  notes               String?
  status              String    @default("active") // active, returned, lost, damaged
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  asset               Asset     @relation(fields: [assetId], references: [id])
  employee            User      @relation("AssignedAssets_New", fields: [employeeId], references: [id])
  approver            User?     @relation("AssignmentApprover", fields: [approvedBy], references: [id])
  
  @@index([assetId])
  @@index([employeeId])
  @@index([status])
}
```

#### 6. **AssetMovement** (NEW)
Complete audit trail of asset movements
```prisma
model AssetMovement {
  id                  Int       @id @default(autoincrement())
  assetId             Int
  fromLocationId      Int?
  toLocationId        Int
  movementType        String    // "new_purchase", "return", "transfer", "repair", "inventory_check"
  reason              String?   // why asset moved
  movedBy             Int       // UserId who recorded the movement
  movementDate        String
  notes               String?
  referenceNumber     String?   // PO, ticket number, etc.
  createdAt           DateTime  @default(now())
  
  asset               Asset     @relation(fields: [assetId], references: [id])
  fromLocation        Location? @relation("AssetMovementFrom", fields: [fromLocationId], references: [id])
  toLocation          Location  @relation("AssetMovementTo", fields: [toLocationId], references: [id])
  movedByUser         User      @relation(fields: [movedBy], references: [id])
  
  @@index([assetId])
  @@index([movementDate])
}
```

#### 7. **AssetConditionLog** (NEW)
Track condition changes over time
```prisma
model AssetConditionLog {
  id                  Int       @id @default(autoincrement())
  assetId             Int
  previousCondition   String
  newCondition        String
  reason              String?   // accident, wear & tear, maintenance, etc.
  notes               String?
  recordedBy          Int       // UserId
  recordedDate        String
  createdAt           DateTime  @default(now())
  
  asset               Asset     @relation(fields: [assetId], references: [id])
  recordedByUser      User      @relation(fields: [recordedBy], references: [id])
  
  @@index([assetId])
  @@index([recordedDate])
}
```

#### 8. **AssetDisposal** (NEW)
Track when assets are disposed, sold, or recycled
```prisma
model AssetDisposal {
  id                  Int       @id @default(autoincrement())
  assetId             Int
  disposalDate        String
  disposalMethod      String    // "scrap", "resell", "donate", "recycling", "transfer"
  buyer               String?   // for resale
  buyerContact        String?
  realizedValue       Float?    // amount received
  disposalNotes       String?
  complianceNotes     String?   // regulatory/compliance info
  disposalLocation    String?
  approvedBy          Int?
  createdAt           DateTime  @default(now())
  
  asset               Asset     @relation(fields: [assetId], references: [id])
  approver            User?     @relation(fields: [approvedBy], references: [id])
  
  @@index([assetId])
  @@index([disposalDate])
}
```

#### 9. **AssetDetachmentRequest** (NEW)
Employee requests to return asset
```prisma
model AssetDetachmentRequest {
  id                  Int       @id @default(autoincrement())
  assetId             Int
  employeeId          Int
  requestDate         String
  reason              String?
  status              String    @default("pending") // pending, approved, rejected
  approvedBy          Int?
  approvalDate        String?
  rejectionReason     String?
  
  // Post-approval action
  postApprovalAction  String?   // "send_for_repair", "scrap", "store_in_custody"
  actionCompletedDate String?
  
  notes               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  asset               Asset     @relation(fields: [assetId], references: [id])
  employee            User      @relation("DetachmentRequests", fields: [employeeId], references: [id])
  approver            User?     @relation("DetachmentApprover", fields: [approvedBy], references: [id])
  
  @@index([assetId])
  @@index([employeeId])
  @@index([status])
}
```

### Models to Update

#### **User** (UPDATE)
```prisma
// Add these fields/relations to existing User model:
field assetsPreviouslyAssigned  AssetAssignment[]   @relation("AssignedAssets_New")
relation assignmentApprovals     AssetAssignment[]   @relation("AssignmentApprover")
relation poCreations             PurchaseOrder[]     @relation("PurchaseOrderCreator")
relation movementRecords         AssetMovement[]
relation conditionLogs           AssetConditionLog[]
relation disposalApprovals       AssetDisposal[]
relation detachmentRequests      AssetDetachmentRequest[] @relation("DetachmentRequests")
relation detachmentApprovals     AssetDetachmentRequest[] @relation("DetachmentApprover")
```

---

## 🔌 API Endpoints Design (30+ endpoints)

### Group 1: Asset Management (8 endpoints)

```
✅ POST   /assets                    - Create new asset
✅ GET    /assets                    - List all assets (with filters)
✅ GET    /assets/:id                - Get asset details + full history
✅ PUT    /assets/:id                - Update asset info
✅ DELETE /assets/:id                - Retire asset
✅ GET    /assets/category/:category - Get all assets by category
✅ GET    /assets/status/:status     - Get assets by status
✅ GET    /assets/search             - Search assets by barcode/serial/tag
```

### Group 2: Purchase & Procurement (5 endpoints)

```
✅ POST   /purchase-orders           - Create PO
✅ GET    /purchase-orders           - List POs
✅ PUT    /purchase-orders/:id       - Update PO status
✅ POST   /purchase-orders/:id/receive - Receive goods (create assets)
✅ GET    /purchase-orders/:id/assets  - Assets from this PO
```

### Group 3: Asset Assignment (7 endpoints)

```
✅ POST   /assignments              - Assign asset to employee
✅ GET    /assignments              - List all assignments
✅ GET    /assignments/active       - Currently assigned assets
✅ GET    /assignments/employee/:empId - Assets assigned to employee
✅ PUT    /assignments/:id/return   - Return asset (with condition)
✅ GET    /assignments/:id/history  - Complete history of this assignment
✅ POST   /assignments/:id/handover - Generate handover PDF + e-sign
```

### Group 4: Asset Movements (4 endpoints)

```
✅ POST   /movements                - Record asset movement
✅ GET    /movements                - List all movements
✅ GET    /movements/asset/:assetId - Movement history for asset
✅ GET    /movements/location/:locId- Assets in this location
```

### Group 5: Asset Conditions (3 endpoints)

```
✅ POST   /conditions               - Log condition change
✅ GET    /conditions/asset/:assetId- Condition history
✅ POST   /conditions/:id/alert     - Alert if condition critical
```

### Group 6: Asset Repair/Maintenance (8 endpoints)
*[These exist from Plan 2, integrate here]*

```
✅ POST   /repairs/:assetId/initiate     - Send for repair
✅ GET    /repairs/:assetId              - Get active repair
✅ GET    /repairs                       - List all repairs
✅ PUT    /repairs/:repairId/update-status
✅ GET    /repairs/overdue               - Overdue repairs
✅ POST   /repairs/:repairId/complete    - Complete repair
✅ GET    /repairs/:assetId/timeline     - Repair history
✅ PUT    /repairs/:repairId/edit        - Update repair details
```

### Group 7: Detachment Requests (5 endpoints)

```
✅ POST   /detachments/request     - Employee requests return
✅ GET    /detachments             - HR admin views all requests
✅ GET    /detachments/pending     - Only pending requests
✅ PUT    /detachments/:id/approve - Approve + choose action
✅ PUT    /detachments/:id/reject  - Reject with reason
```

### Group 8: Asset Disposal (3 endpoints)

```
✅ POST   /disposals              - Record disposal
✅ GET    /disposals              - List disposed assets
✅ GET    /disposals/:id/details  - Disposal info + recovery value
```

### Group 9: Dashboard & Reports (5 endpoints)

```
✅ GET    /dashboard/summary      - Asset counts by status/category
✅ GET    /dashboard/value        - Total asset value, depreciation
✅ GET    /reports/lifecycle      - Asset lifecycle report
✅ GET    /reports/movement       - Asset movement history
✅ GET    /reports/overdue        - Overdue repairs, unreturned assets
```

---

## 🎨 Frontend Components (12+ pages)

### Admin Dashboard
- **Asset Summary Dashboard**
  - Total assets by category
  - Assets by status (in_stock, assigned, in_repair, in_custody, disposed)
  - Asset value tracking
  - Overdue repairs & unreturned assets

### Asset Management
- **Asset Inventory Page**
  - Search/filter by category, status, location, assignee
  - List view with QR code, barcode
  - Bulk actions (mark for repair, dispose, transfer)
  - Add new asset

- **Asset Detail Page**
  - Complete asset info (brand, model, serial, cost, warranty)
  - Full lifecycle history (purchase → assignment → return → disposal)
  - Current status and location
  - Movement timeline
  - Condition logs
  - All repairs/maintenance records

### Procurement Integration
- **Purchase Order Management**
  - Create PO with vendor details
  - Receive goods (GRN) → auto-create asset records
  - Track delivery status

### Assignment & Return
- **Asset Assignment Form (HR/Admin)**
  - Search/filter available assets
  - Select employee & expected return date
  - Generate handover document
  - E-signature capture

- **Asset Return Portal (Employee)**
  - Self-detachment request form
  - Reason for return
  - Condition reporting
  - Photos/documentation

- **HR Approval Workflow**
  - View pending detachment requests
  - Approve/reject
  - Choose post-approval action (repair, scrap, custody)
  - Generate collection request

### Employee Self-Service
- **My Assets Page (Employee)**
  - View assigned assets
  - Request detachment/return
  - Report damage/issues
  - Upload photos of condition

- **Asset Return Self-Service**
  - List assets to return
  - Report condition
  - Get return pickup schedule

### Reports & Analytics
- **Asset Lifecycle Report**
  - All assets from purchase to disposal
  - Time in each status
  - Movement history

- **Vendor Performance Report**
  - Assets by vendor
  - Warranty claims
  - Repair frequency

- **Financial Report**
  - Asset value by category
  - Depreciation
  - Recovery value from disposals
  - Cost analysis

---

## 🔄 Workflow Designs

### Workflow 1: Purchase to Stock

```
1. Admin creates PO in procurement system
2. Vendor delivers goods
3. HR/Admin receives goods (GRN)
4. System auto-creates Asset records:
   - Sets status = "in_stock"
   - Assigns to warehouse location
   - Generates barcode/QR code
   - Records vendor, purchase date, cost
5. Asset ready for assignment
```

### Workflow 2: Assignment to Employee

```
1. HR needs assets for new employee (onboarding)
2. Query available assets by category & location
3. Select assets → Create assignment
4. System:
   - Status = "assigned"
   - Links to employee
   - Records assigned date & approver
5. Generate handover PDF
6. Employee e-signs receipt
7. Record assignment complete
```

### Workflow 3: Employee Self-Detachment + HR Approval + Action

```
1. Employee requests asset return:
   - Provides reason
   - Reports condition
   - Files detachment request
   
2. HR Admin reviews request:
   - Approves or rejects
   - If approved, chooses action:
     a) Send for repair → Create repair record
     b) Scrap/Dispose → Create disposal record
     c) Store in custody → Status = "in_custody", location = admin_storage
   
3. If approved with custody action:
   - Asset status = "in_custody"
   - Location = HR storage/office
   - HR can later decide: repair, resell, or scrap
   
4. If employee disconnects in offboarding:
   - System shows all assets to collect
   - HR collects and returns to stock or processes disposal
```

### Workflow 4: Asset Transfer (Employee Relocation)

```
1. Employee moves department/city
2. System checks: Can asset go with them or needs return?
3. If transfer:
   - Update location
   - Record movement
   - Update assignment record
4. If return:
   - Trigger return workflow
   - Options: reassign, repair, store
```

### Workflow 5: Maintenance/Repair (From Plan 2)

```
1. Asset needs repair
2. Admin marks asset for repair
3. Status = "in_repair"
4. Track vendor, ticket, expected return date
5. Overdue alert if exceeds date
6. On completion, return to "in_stock" or "assigned"
7. Create audit record
```

### Workflow 6: Disposal/Scrapping

```
1. Asset marked as obsolete/damaged
2. Admin records disposal details:
   - Method (scrap, resell, donate, recycle)
   - Buyer (if sold)
   - Recovery value
3. Update asset status = "disposed"
4. Record financial impact
5. Generate compliance/audit trail
```

### Workflow 7: Reuse Before New Purchase

```
1. Department needs new asset (e.g., laptop)
2. Before raising PO, system checks:
   - Any available laptops in stock?
   - Any returned laptops in good condition?
3. If available → suggest reuse
   - Saves cost
   - Reduce e-waste
4. If not available → proceed with PO
```

---

## 🔗 System Integrations

### 1. HRMS Integration
```
On Employee Onboarding:
  → Trigger asset assignment workflow
  → Suggest assets by department/role
  → Create assignment records

On Employee Transfer:
  → Check asset location compatibility
  → Suggest transfer or return

On Employee Offboarding:
  → Auto-generate asset collection list
  → Prevent separation until all assets returned
  → Record final asset returns
```

### 2. Procurement Integration
```
When PO received (GRN done):
  → Auto-create Asset records
  → Link to vendor
  → Record cost & dates
  → Move to "in_stock"
```

### 3. Inventory/Warehouse
```
All movements tracked:
  → Barcode/QR scanning
  → Location updates
  → Stock level visibility
  → Transfer history
```

### 4. Financial/Accounting
```
Asset information for:
  → Capital expenditure (CAPEX) tracking
  → Depreciation calculation
  → Fixed assets register
  → Disposal recovery value
  → Cost center allocation
```

---

## 📈 Key Reports

1. **Asset Summary** - Total assets, by category, status, location
2. **Asset Value Report** - Purchase value, depreciation, current value
3. **Lifecycle Report** - Each asset's complete journey
4. **Movement History** - Where assets have been, when, why
5. **Assignment Report** - Who has what, when assigned, return dates
6. **Overdue Report** - Unreturned assets, overdue repairs
7. **Vendor Report** - Assets by vendor, reliability, costs
8. **Financial Report** - CAPEX, depreciation, disposal recovery
9. **Compliance Report** - Disposal audit trail, e-waste tracking
10. **Utilization Report** - Asset usage patterns, idle assets

---

## ✅ Implementation Phases

### **Phase 1: Core System (3-4 days)**
- Database schema (all 10 models)
- Basic CRUD endpoints (25+ endpoints)
- Asset inventory UI
- Asset detail page with history
- Purchase order management

### **Phase 2: Assignment & Detachment (2 days)**
- Assignment workflow
- Employee self-detachment
- HR approval & post-action choices
- Handover documents

### **Phase 3: Integrations (2 days)**
- HRMS integration (onboarding/offboarding)
- Procurement integration (auto-asset creation)
- Inventory location tracking

### **Phase 4: Reports & Analytics (1 day)**
- Dashboard
- 10+ reports
- Asset value tracking
- Financial integration

### **Phase 5: Testing & Deployment (1 day)**
- Full end-to-end testing
- Performance optimization
- Documentation
- Production deployment

**Total Estimated Time: 9-10 days**

---

## 🎯 Success Criteria

- ✅ Every asset has complete lifecycle record
- ✅ All movements tracked with who/when/why
- ✅ Employees can self-request asset return
- ✅ HR can approve & choose post-action
- ✅ Assets auto-created from purchase orders
- ✅ No asset lost or untracked
- ✅ Compliance & audit trail complete
- ✅ Financial tracking accurate
- ✅ Reuse before new purchase enabled
- ✅ All integrations working

---

## 📝 Next Steps

1. **Review & Approve** this design
2. **Confirm** asset categories and types
3. **Start Phase 1** database schema + basic endpoints
4. **Integrate** with existing greytHR migration work
5. **Test** with real asset data

---

**Status: DESIGN COMPLETE - AWAITING APPROVAL**

Shall I proceed with Phase 1 implementation?

