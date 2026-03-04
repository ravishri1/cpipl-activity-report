# Asset Lifecycle Management System - Complete API Reference

**Status:** ✅ COMPLETE  
**Base URL:** `http://localhost:5000/api/asset-lifecycle`  
**Authentication:** JWT Token (Bearer in Authorization header)  
**Content-Type:** `application/json`

---

## Authentication

All endpoints require JWT authentication. Obtain token via:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@cpipl.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGc...",
  "user": { "id": 1, "email": "...", "role": "admin" }
}
```

**Use token in all requests:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:5000/api/asset-lifecycle/vendors
```

---

## Quick Reference

| Group | Endpoints | Admin-Only |
|-------|-----------|-----------|
| Vendor Management | 4 | ✅ All |
| Location Management | 4 | ✅ All |
| Purchase Orders | 5 | ✅ Create/Approve |
| Asset Assignment | 4 | ❌ Mixed |
| Asset Movement | 3 | ✅ Record |
| Asset Condition | 2 | ✅ Log |
| Asset Disposal | 3 | ✅ Request/Approve |
| Asset Detachment | 4 | ✅ Request/Approve |
| Repairs | 5 | ✅ Manage |
| Dashboard | 1 | ❌ Everyone |

---

## 1. VENDOR MANAGEMENT (4 endpoints)

### 1.1 Create Vendor
```
POST /vendors
ADMIN ONLY ✅
```

**Request:**
```json
{
  "name": "TechSupplies Ltd",
  "phone": "9876543210",
  "email": "vendor@techsupplies.com",
  "address": "123 Business Park",
  "city": "Bangalore",
  "state": "Karnataka",
  "gstNumber": "29AABCT1234H1Z0",
  "panNumber": "AAAPL1234Q",
  "vendorType": "equipment",
  "paymentTerms": "net_30",
  "bankDetails": {
    "bankName": "ICICI Bank",
    "accountNumber": "1234567890",
    "ifscCode": "ICIC0000001"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "TechSupplies Ltd",
  "phone": "9876543210",
  "email": "vendor@techsupplies.com",
  "gstNumber": "29AABCT1234H1Z0",
  "vendorType": "equipment",
  "isActive": true,
  "createdAt": "2026-03-04T10:30:00Z",
  "updatedAt": "2026-03-04T10:30:00Z"
}
```

**Error Codes:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Vendor with this GST number already exists
- `403 Forbidden` - Not admin

---

### 1.2 List All Vendors
```
GET /vendors
EVERYONE ✅
```

**Query Parameters:**
```
?offset=0&limit=50&isActive=true&vendorType=equipment
```

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "name": "TechSupplies Ltd",
      "phone": "9876543210",
      "city": "Bangalore",
      "vendorType": "equipment",
      "isActive": true,
      "createdAt": "2026-03-04T10:30:00Z"
    }
  ],
  "offset": 0,
  "limit": 50,
  "total": 15,
  "hasMore": false
}
```

---

### 1.3 Get Vendor Details
```
GET /vendors/:id
EVERYONE ✅
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "TechSupplies Ltd",
  "phone": "9876543210",
  "email": "vendor@techsupplies.com",
  "address": "123 Business Park",
  "city": "Bangalore",
  "state": "Karnataka",
  "gstNumber": "29AABCT1234H1Z0",
  "panNumber": "AAAPL1234Q",
  "vendorType": "equipment",
  "paymentTerms": "net_30",
  "bankDetails": {
    "bankName": "ICICI Bank",
    "accountNumber": "***7890",
    "ifscCode": "ICIC0000001"
  },
  "isActive": true,
  "purchaseOrders": [],
  "repairs": [],
  "createdAt": "2026-03-04T10:30:00Z",
  "updatedAt": "2026-03-04T10:30:00Z"
}
```

---

### 1.4 Update Vendor
```
PUT /vendors/:id
ADMIN ONLY ✅
```

**Request:** (all fields optional)
```json
{
  "phone": "9876543211",
  "paymentTerms": "net_45",
  "isActive": false
}
```

**Response:** `200 OK` (returns updated vendor)

---

## 2. LOCATION MANAGEMENT (4 endpoints)

### 2.1 Create Location
```
POST /locations
ADMIN ONLY ✅
```

**Request:**
```json
{
  "name": "Bangalore Office - Floor 2",
  "type": "office",
  "address": "Tech Park, Whitefield",
  "city": "Bangalore",
  "state": "Karnataka",
  "pincode": "560066",
  "inchargeUserId": 1,
  "capacity": 50
}
```

**Response:** `201 Created`

---

### 2.2 List All Locations
```
GET /locations
EVERYONE ✅
```

**Query Parameters:**
```
?offset=0&limit=50&type=office
```

**Response:** `200 OK` (paginated list)

---

### 2.3 Get Location Details
```
GET /locations/:id
EVERYONE ✅
```

**Response:** `200 OK` (includes movements)

---

### 2.4 Update Location
```
PUT /locations/:id
ADMIN ONLY ✅
```

**Request:**
```json
{
  "name": "Bangalore Office - Updated",
  "capacity": 75
}
```

---

## 3. PURCHASE ORDER MANAGEMENT (5 endpoints)

### 3.1 Create Purchase Order
```
POST /purchase-orders
ADMIN ONLY ✅
```

**Request:**
```json
{
  "poNumber": "PO-2026-001",
  "vendorId": 1,
  "poDate": "2026-03-04",
  "items": [
    {
      "description": "Dell XPS 13 Laptop",
      "quantity": 5,
      "unitPrice": 85000,
      "gst": 18
    }
  ],
  "totalAmount": 501500,
  "notes": "Urgent delivery needed"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "poNumber": "PO-2026-001",
  "vendorId": 1,
  "poDate": "2026-03-04",
  "status": "draft",
  "items": [...],
  "totalAmount": 501500,
  "createdAt": "2026-03-04T10:30:00Z"
}
```

---

### 3.2 List Purchase Orders
```
GET /purchase-orders
EVERYONE ✅
```

**Query:**
```
?status=pending&vendorId=1&offset=0&limit=50
```

---

### 3.3 Approve Purchase Order
```
PUT /purchase-orders/:id/approve
ADMIN ONLY ✅
```

**Request:**
```json
{
  "notes": "Approved by Finance"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "status": "approved",
  "approvedAt": "2026-03-04T10:35:00Z"
}
```

---

### 3.4 Receive Goods (GRN)
```
PUT /purchase-orders/:id/receive-goods
ADMIN ONLY ✅
```

**Request:**
```json
{
  "grnNumber": "GRN-2026-001",
  "grnDate": "2026-03-04",
  "receivedItems": [
    {
      "description": "Dell XPS 13 Laptop",
      "quantityReceived": 5,
      "qualityStatus": "ok"
    }
  ],
  "notes": "All items received in good condition"
}
```

**Response:** `200 OK`

---

### 3.5 Update Purchase Order
```
PUT /purchase-orders/:id
ADMIN ONLY ✅
```

**Request:**
```json
{
  "notes": "Updated delivery date"
}
```

---

## 4. ASSET ASSIGNMENT (4 endpoints)

### 4.1 Assign Asset to Employee
```
POST /assignments
ADMIN ONLY ✅
```

**Request:**
```json
{
  "assetId": 1,
  "userId": 5,
  "assignmentDate": "2026-03-04",
  "condition": "new",
  "notes": "Assigned to Rahul for development work"
}
```

**Response:** `201 Created`

---

### 4.2 List Assignments
```
GET /assignments
EVERYONE ✅
```

**Query:**
```
?userId=5&status=active&offset=0&limit=50
```

---

### 4.3 Return Asset
```
PUT /assignments/:id/return
EMPLOYEE OR ADMIN ✅
```

**Request:**
```json
{
  "returnDate": "2026-03-04",
  "condition": "good",
  "notes": "Returned in good working condition"
}
```

**Response:** `200 OK`

---

### 4.4 Assignment History
```
GET /assignments/:id/history
EVERYONE ✅
```

**Response:** `200 OK` (shows all assignments for asset)

---

## 5. ASSET MOVEMENT (3 endpoints)

### 5.1 Record Asset Movement
```
POST /movements
ADMIN ONLY ✅
```

**Request:**
```json
{
  "assetId": 1,
  "fromLocation": 1,
  "toLocation": 2,
  "movementType": "transfer",
  "movementDate": "2026-03-04",
  "movementTime": "10:30",
  "reason": "Relocated to new office",
  "quantity": 1,
  "barcode": "ASSET-001",
  "notes": "Moved with insurance coverage"
}
```

**Response:** `201 Created`

---

### 5.2 List Movements
```
GET /movements
EVERYONE ✅
```

**Query:**
```
?assetId=1&movementType=transfer&offset=0&limit=50
```

---

### 5.3 Stock at Location
```
GET /locations/:id/stock
EVERYONE ✅
```

**Response:** `200 OK`
```json
{
  "location": {
    "id": 1,
    "name": "Bangalore Office - Floor 2",
    "capacity": 50
  },
  "stock": [
    {
      "condition": "new",
      "count": 10
    },
    {
      "condition": "good",
      "count": 15
    }
  ],
  "totalAssets": 25
}
```

---

## 6. ASSET CONDITION (2 endpoints)

### 6.1 Log Condition Check
```
POST /assets/:assetId/condition
ADMIN ONLY ✅
```

**Request:**
```json
{
  "previousCondition": "good",
  "newCondition": "fair",
  "checkDate": "2026-03-04",
  "notes": "Minor scratches observed",
  "photosUrl": ["https://cdn.example.com/photo1.jpg"],
  "requiresRepair": false
}
```

**Response:** `201 Created`

---

### 6.2 Condition History
```
GET /assets/:assetId/condition-history
EVERYONE ✅
```

**Response:** `200 OK`
```json
{
  "assetId": 1,
  "logs": [
    {
      "id": 1,
      "previousCondition": "good",
      "newCondition": "fair",
      "checkDate": "2026-03-04",
      "checkedBy": "admin@cpipl.com",
      "requiresRepair": false
    }
  ]
}
```

---

## 7. ASSET DISPOSAL (3 endpoints)

### 7.1 Request Asset Disposal
```
POST /disposals
ADMIN ONLY ✅
```

**Request:**
```json
{
  "assetId": 1,
  "disposalType": "scrap",
  "disposalReason": "Asset is beyond repair",
  "disposalDate": "2026-03-04",
  "recoveryValue": 0,
  "recoveryVendor": null,
  "notes": "Completely non-functional"
}
```

**Response:** `201 Created`

---

### 7.2 Approve Disposal
```
PUT /disposals/:id/approve
ADMIN ONLY ✅
```

**Request:**
```json
{
  "certificateUrl": "https://cdn.example.com/disposal-cert.pdf",
  "notes": "Approved by Finance"
}
```

---

### 7.3 List Disposals
```
GET /disposals
EVERYONE ✅
```

**Query:**
```
?status=approved&offset=0&limit=50
```

---

## 8. ASSET DETACHMENT (4 endpoints)

### 8.1 Request Asset Detachment
```
POST /detachments
EMPLOYEE OR ADMIN ✅
```

**Request:**
```json
{
  "assetId": 1,
  "reason": "No longer needed for project",
  "description": "Project A is now using company equipment instead",
  "postApprovalAction": "return_to_stock"
}
```

**Response:** `201 Created`

---

### 8.2 Approve Detachment
```
PUT /detachments/:id/approve
ADMIN ONLY ✅
```

**Request:**
```json
{
  "postApprovalAction": "return_to_stock",
  "notes": "Approved and returned"
}
```

---

### 8.3 Reject Detachment
```
PUT /detachments/:id/reject
ADMIN ONLY ✅
```

**Request:**
```json
{
  "notes": "Asset still required for ongoing projects"
}
```

---

### 8.4 List Detachment Requests
```
GET /detachments
EVERYONE ✅
```

**Query:**
```
?status=pending&offset=0&limit=50
```

---

## 9. ASSET REPAIRS (5 endpoints)

### 9.1 Create Repair Record
```
POST /repairs
ADMIN ONLY ✅
```

**Request:**
```json
{
  "assetId": 1,
  "repairType": "preventive",
  "status": "scheduled",
  "sentOutDate": "2026-03-04",
  "expectedReturnDate": "2026-03-08",
  "vendorId": 1,
  "notes": "Regular maintenance"
}
```

**Response:** `201 Created`

---

### 9.2 Update Repair Status
```
PUT /repairs/:id/status
ADMIN ONLY ✅
```

**Request:**
```json
{
  "status": "in_progress",
  "notes": "Started repair work"
}
```

---

### 9.3 Close Repair (Return from Vendor)
```
PUT /repairs/:id/close
ADMIN ONLY ✅
```

**Request:**
```json
{
  "actualReturnDate": "2026-03-07",
  "costs": 2500,
  "invoiceNumber": "INV-123456",
  "notes": "Repair completed successfully"
}
```

---

### 9.4 Repair Timeline
```
GET /repairs/:id/timeline
EVERYONE ✅
```

**Response:** `200 OK` (shows all status changes)

---

### 9.5 List Repairs
```
GET /repairs
EVERYONE ✅
```

**Query:**
```
?status=in_progress&assetId=1&offset=0&limit=50
```

---

## 10. DASHBOARD (1 endpoint)

### 10.1 Asset Lifecycle Dashboard
```
GET /dashboard/metrics
EVERYONE ✅
```

**Response:** `200 OK`
```json
{
  "summary": {
    "totalAssets": 150,
    "activeAssignments": 120,
    "pendingRepairs": 5,
    "disposalsPending": 2
  },
  "byCondition": {
    "new": 30,
    "good": 85,
    "fair": 25,
    "damaged": 8,
    "non_working": 2,
    "beyond_repair": 0
  },
  "byLocation": [
    {
      "location": "Bangalore Office - Floor 2",
      "count": 100
    },
    {
      "location": "Bangalore Office - Warehouse",
      "count": 50
    }
  ],
  "poSummary": {
    "total": 20,
    "draft": 2,
    "approved": 15,
    "received": 3
  },
  "recentActivities": [
    {
      "type": "assignment",
      "assetId": 1,
      "userId": 5,
      "date": "2026-03-04T10:30:00Z"
    }
  ]
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": "Vendor with this name already exists",
  "statusCode": 409,
  "timestamp": "2026-03-04T10:30:00Z"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Vendor retrieved |
| 201 | Created | Vendor created |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | Not admin for admin-only endpoint |
| 404 | Not Found | Vendor doesn't exist |
| 409 | Conflict | Duplicate vendor name |
| 500 | Server Error | Unexpected error |

---

## Pagination

All list endpoints support:
```
?offset=0&limit=50

Response includes:
{
  "items": [...],
  "offset": 0,
  "limit": 50,
  "total": 100,
  "hasMore": true
}
```

---

## Status Values

**Purchase Order Status:**
- `draft` → `approved` → `received`

**Asset Assignment Status:**
- `active` → `returned`

**Repair Status:**
- `scheduled` → `in_progress` → `completed`

**Disposal Status:**
- `pending` → `approved` / `rejected`

**Detachment Status:**
- `pending` → `approved` / `rejected`

**Asset Condition:**
- `new`, `good`, `fair`, `damaged`, `non_working`, `beyond_repair`

---

## Complete Example Workflow

### 1. Create Vendor
```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/vendors \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"TechSupplies","phone":"9876543210","email":"v@tech.com"}'
```

### 2. Create Location
```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/locations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Warehouse","type":"warehouse","city":"Bangalore"}'
```

### 3. Create Purchase Order
```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/purchase-orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"poNumber":"PO-001","vendorId":1,"items":[...]}'
```

### 4. Approve PO
```bash
curl -X PUT http://localhost:5000/api/asset-lifecycle/purchase-orders/1/approve \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Approved"}'
```

### 5. Assign Asset
```bash
curl -X POST http://localhost:5000/api/asset-lifecycle/assignments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"assetId":1,"userId":5,"assignmentDate":"2026-03-04"}'
```

### 6. Check Dashboard
```bash
curl -X GET http://localhost:5000/api/asset-lifecycle/dashboard/metrics \
  -H "Authorization: Bearer TOKEN"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-04 | Initial release - 30 endpoints |

