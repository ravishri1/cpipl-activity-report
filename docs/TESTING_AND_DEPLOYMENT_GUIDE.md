# Google Drive File Management System - Testing & Deployment Guide

**Project Status:** ✅ IMPLEMENTATION COMPLETE
**Last Updated:** March 3, 2026
**Document Version:** 1.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Implementation Summary](#implementation-summary)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Test Execution Guide](#test-execution-guide)
5. [Manual Verification Procedures](#manual-verification-procedures)
6. [Database Schema Verification](#database-schema-verification)
7. [API Endpoint Testing](#api-endpoint-testing)
8. [Frontend Component Testing](#frontend-component-testing)
9. [Error Handling Verification](#error-handling-verification)
10. [Performance Considerations](#performance-considerations)
11. [Deployment Checklist](#deployment-checklist)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## Quick Start

### Start Backend Server (Dev Mode)

```bash
cd "D:\Activity Report Software\server"
npm run dev
```

Server will start on `http://localhost:5000` using nodemon (auto-reloads on file changes)

### Start Frontend (Dev Mode)

```bash
cd "D:\Activity Report Software\client"
npm run dev
```

Frontend will run on `http://localhost:3000` (proxied to backend)

### Production Build

```bash
# Backend - no build needed, runs Node.js directly
cd "D:\Activity Report Software\server"
npm run start

# Frontend - build static files
cd "D:\Activity Report Software\client"
npm run build
```

---

## Implementation Summary

### Completed Components

#### Backend
✅ **Database Schema** (`server/prisma/schema.prisma`)
- `DriveFile` model with userId, driveFileId, fileName, mimeType, fileSize, driveUrl, thumbnailUrl, category, description, uploadedAt
- User model extensions: `driveProfilePhotoUrl`, `driveFolderId`, `driveFiles` relation
- Proper indexes on userId, category, and combined userId+category

✅ **Google Drive Service** (`server/src/services/google/googleDrive.js`)
- `getDriveClient()` - Authenticated Drive v3 client
- `getOrCreateRootFolder()` - Creates/finds "CPIPL HR Files" root folder
- `getOrCreateEmployeeFolder()` - Per-employee subfolders with format "{name} ({employeeId})"
- `uploadFile()` - File upload with anyoneWithLink=reader sharing
- `deleteFile()` - File deletion from Drive
- `listFiles()` - List folder contents
- `ensureEmployeeFolder()` - Lazy folder creation
- `getDirectImageUrl()` - Direct image URL generation
- `friendlyDriveError()` - User-friendly error messages

✅ **Invoice Extractor Service** (`server/src/services/invoiceExtractor.js`)
- `extractInvoiceData()` - Single file extraction using Gemini 2.0 Flash
- `extractMultipleInvoices()` - Batch extraction (max 3 files, max 3MB each)
- Supported file types: image/jpeg, image/png, image/webp, application/pdf
- Returns structured data: vendor, amount, date, category, description, items, gstNumber, invoiceNumber

✅ **File Routes** (`server/src/routes/files.js`) - 10 Endpoints
1. `POST /upload` - Upload file for self (15MB limit)
2. `POST /upload/:userId` - Admin uploads for employee
3. `GET /my` - List own files with optional category filter
4. `GET /user/:userId` - Admin lists employee files
5. `DELETE /:fileId` - Delete file (owner or admin)
6. `POST /extract-receipt` - Extract single receipt data
7. `POST /extract-receipts` - Batch extract up to 3 receipts (3MB each)
8. `POST /bulk-photos` - Bulk upload photos from ZIP with employee ID matching
9. `POST /upload-profile-photo` - Upload profile photo
10. `POST /fix-photo-urls` - Migrate old profile photo URLs

#### Frontend
✅ **Employee Profile - Drive Files Tab** (`client/src/components/employees/EmployeeProfile.jsx`)
- Category filters: All, Documents, Receipts, ID Proofs, Education, Photos, Other
- File list with thumbnails/icons, download links, delete buttons
- Upload button (admin only) with validation
- Open in Drive link for external access
- Loading states and empty state messaging
- Metadata display with proper formatting
- Color-coded category badges

✅ **My Files Page** (`client/src/components/files/MyFiles.jsx`)
- Employee-facing file portal
- Drag-and-drop file upload
- Category filtering
- File grid with thumbnails
- Download and delete functionality
- Upload progress indicator
- Empty state messaging

✅ **Expense Receipt Upload + Batch Extraction** (`client/src/components/expenses/MyExpenses.jsx`)
- Multi-file drop zone (up to 3 files, max 3MB each)
- Extraction results panel with editable fields
- Extracted data cards: vendor, amount, date, category, description
- Apply to form button per invoice
- Submit All for batch expense creation
- Auto-update receiptUrl with Drive URL

✅ **Navigation Integration** (`client/src/components/layout/Sidebar.jsx`, `client/src/App.jsx`)
- "My Files" nav item in sidebar with FolderOpen icon
- Route `/my-files` added to App routing
- Lazy loading of MyFiles component

### Database

✅ **Schema Applied**
- `npx prisma db push` completed successfully
- DriveFile table created with proper relationships
- Indexes created for optimal query performance
- Backward compatible with existing data

### Environment Configuration

✅ **Required Settings**
- `.env` file contains: DATABASE_URL, JWT_SECRET, GOOGLE_CREDENTIALS (base64)
- `google-service-account.json` present for Drive API authentication
- Gemini API key in Settings table (existing infrastructure)

---

## Pre-Deployment Checklist

### Local Development Prerequisites

- [ ] Node.js v22+ installed (`node --version`)
- [ ] npm v10+ installed (`npm --version`)
- [ ] SQLite database accessible (`server/prisma/dev.db`)
- [ ] Google Service Account configured for Drive API
- [ ] Gemini API key available in Settings table
- [ ] Port 5000 (backend) and 3000 (frontend) available

### Code Quality

- [ ] No console errors or warnings in browser DevTools
- [ ] No unhandled promise rejections
- [ ] All API endpoints return proper error handling
- [ ] File uploads validated at multiple levels:
  - Frontend: File size, type, count
  - Multer middleware: Size limits
  - Backend route handlers: Additional validation
  - Drive API: Upload success confirmation

### Security

- [ ] Authentication middleware present on all protected routes
- [ ] Admin-only routes use `requireAdmin` middleware
- [ ] User files accessible only to owner or admin
- [ ] File sharing set to `anyoneWithLink=reader` (preview-only)
- [ ] No sensitive data in URLs or logs
- [ ] CORS properly configured for frontend domain

---

## Test Execution Guide

### Test Files Location

```
server/
├── test-drive-files-tab.js           (283 lines - 13 scenarios)
├── test-bulk-photo-upload.js         (376 lines - 11 scenarios)
└── test-receipt-extraction.js        (347 lines - 12 scenarios)
```

### Setup for Running Tests

```bash
# 1. Ensure backend is running
cd "D:\Activity Report Software\server"
npm run dev

# 2. Wait for backend to start (should see "Server running on port 5000")
# 3. In a new terminal, run tests from server directory

cd "D:\Activity Report Software\server"
```

### Test 1: Employee Profile Drive Files Tab

**What it tests:**
- Fetching employee files
- Category filtering
- File metadata
- File deletion
- Access control (owner/admin)

**Run:**
```bash
node test-drive-files-tab.js
```

**Expected output:**
```
[INFO] Test Suite: Employee Profile Drive Files Tab Functionality
[INFO] 1. Admin Login: SUCCESS
[INFO] 2. Fetch Test User: SUCCESS
[INFO] 3. Fetch Initial Files (empty): SUCCESS
[INFO] ... (total 13 test scenarios)
[SUCCESS] All tests completed!
```

**Failure scenarios tested:**
- Non-admin access to admin endpoints (should fail with 403)
- Accessing other user's files (should fail with 403)
- Category filter with invalid category (should return only matching)
- Delete non-existent file (should fail with 404)

### Test 2: Bulk Photo Upload

**What it tests:**
- ZIP file handling with adm-zip
- Employee ID matching from filenames
- Profile photo URL updates (driveProfilePhotoUrl field)
- DriveFile record creation
- Metadata completeness
- Throttling behavior (200ms between uploads)
- Error handling for invalid ZIP/formats

**Run:**
```bash
node test-bulk-photo-upload.js
```

**Expected output:**
```
[INFO] Bulk Photo Upload Test Suite
[INFO] Creating test photos ZIP...
[INFO] 1. Admin Login: SUCCESS
[INFO] 2. Fetch employees for testing: SUCCESS
[INFO] 3. Upload ZIP with photos: SUCCESS
[INFO] ... (total 11 test scenarios)
[SUCCESS] All photos uploaded and verified!
```

**File naming requirement:**
- Format: `{employeeId}.jpg` (e.g., `EMP001.jpg`, `COLOR001.jpg`)
- Supported types: .jpg, .jpeg, .png, .webp
- Max file size: 15MB per file
- Max ZIP size: 200MB
- Throttling: 200ms delay between uploads to avoid Drive API quota issues

### Test 3: Receipt Extraction

**What it tests:**
- Single receipt extraction
- Batch extraction (up to 3 files)
- Gemini Vision API integration
- DriveFile record creation for extracted files
- Metadata in extraction response
- File count validation (max 3)
- File size validation (max 3MB each)
- Supported file types

**Run:**
```bash
node test-receipt-extraction.js
```

**Expected output:**
```
[INFO] Receipt Extraction Test Suite
[INFO] 1. Member Login: SUCCESS
[INFO] 2. Verify extraction service: SUCCESS
[INFO] 3. Single receipt extraction: SUCCESS
[INFO] 4. Extract vendor, amount, date: SUCCESS
[INFO] ... (total 12 test scenarios)
[SUCCESS] All extraction tests completed!
```

**Supported formats:**
- Images: image/jpeg, image/png, image/webp
- Documents: application/pdf
- Max file size: 3MB per receipt
- Max batch size: 3 files
- Extraction fields returned: vendor, amount, date, category, description, items, gstNumber, invoiceNumber

---

## Manual Verification Procedures

### 1. Frontend Component Display

**In Browser (http://localhost:3000):**

Login as admin@cpipl.com / password123

#### Check Employee Profile Tab
```
1. Navigate to Admin → Directory
2. Click on any employee profile
3. Look for "Drive Files" tab (should have FolderOpen icon)
4. Verify category filter tabs: All, Documents, Receipts, ID Proofs, Education, Photos, Other
5. Upload a test document (click Upload button)
6. Verify file appears in list with:
   - Thumbnail/icon based on file type
   - File name and size
   - Category badge
   - Download and Delete buttons
7. Test delete - verify file removed from list and Drive
```

#### Check My Files Page (Employee View)
```
1. Log out, login as rahul@cpipl.com / password123 (member role)
2. Click "My Files" in sidebar
3. Verify you see your own files only
4. Test drag-and-drop upload
5. Test category filtering
6. Verify upload progress indicator appears
```

#### Check Receipt Extraction in Expenses
```
1. Navigate to Expenses → New Expense
2. Find receipt upload section
3. Drop 1-3 receipt images/PDFs
4. Verify extraction results appear with editable fields
5. Verify vendor/amount/date are extracted
6. Click "Apply to Form" to fill expense form
7. Submit and verify receipt URL is saved
```

### 2. Database Verification

```bash
# Open Prisma Studio
cd "D:\Activity Report Software\server"
npx prisma studio
```

Navigate to:
- **DriveFile table** - Should show:
  - id, userId, driveFileId, fileName, mimeType
  - fileSize, driveUrl, thumbnailUrl, category
  - description, uploadedAt, user (relation)
  
- **User table** - Check these fields exist:
  - driveProfilePhotoUrl (String, nullable)
  - driveFolderId (String, nullable)
  - driveFiles (relation)

Verify records created after file uploads:
```sql
-- Check DriveFile records
SELECT id, userId, fileName, category, uploadedAt 
FROM DriveFile 
ORDER BY uploadedAt DESC 
LIMIT 10;

-- Check user profile photo updates
SELECT id, name, driveProfilePhotoUrl 
FROM User 
WHERE driveProfilePhotoUrl IS NOT NULL;

-- Check folder IDs set
SELECT id, name, driveFolderId 
FROM User 
WHERE driveFolderId IS NOT NULL;
```

### 3. Google Drive Verification

**In Google Drive (Drive folder of Service Account):**

1. Open "CPIPL HR Files" folder (root)
2. Verify structure:
   ```
   CPIPL HR Files/
   ├── Alice Johnson (EMP001)/
   ├── Bob Smith (EMP002)/
   ├── Charlie Brown (EMP003)/
   └── ...
   ```

3. Inside each employee folder, verify:
   - `Category: Documents/` (for PDFs, Word docs)
   - `Category: Receipts/` (for invoice/receipt images)
   - `Category: Photos/` (for profile photos)
   - `Category: ID Proofs/` (for ID documents)
   - `Category: Education/` (for education docs)
   - `Category: Other/` (miscellaneous)

4. Right-click any file → Share settings:
   - Should show "Anyone with the link can view"
   - No access restriction

5. Copy any file's link and verify it opens in preview mode (not download)

---

## Database Schema Verification

### Schema Changes Applied

```prisma
// Added to User model
driveProfilePhotoUrl  String?
driveFolderId         String?
driveFiles            DriveFile[]

// New model
model DriveFile {
  id            Int       @id @default(autoincrement())
  userId        Int
  driveFileId   String    @unique
  driveFolderId String
  fileName      String
  mimeType      String
  fileSize      Int       @default(0)
  driveUrl      String
  thumbnailUrl  String?
  category      String    @default("other")
  description   String?
  uploadedAt    DateTime  @default(now())
  user          User      @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([category])
  @@index([userId, category])
}
```

### Verify Schema Applied

```bash
# Check Prisma models
npx prisma validate

# View schema
npx prisma studio

# Check database tables
sqlite3 "server/prisma/dev.db"
> .tables
> .schema DriveFile
> .schema User
```

---

## API Endpoint Testing

### Endpoint Summary

| # | Method | Path | Auth | Purpose | Status |
|---|--------|------|------|---------|--------|
| 1 | POST | `/api/files/upload` | User | Upload file for self | ✅ |
| 2 | POST | `/api/files/upload/:userId` | Admin | Admin uploads for user | ✅ |
| 3 | GET | `/api/files/my?category=` | User | List own files | ✅ |
| 4 | GET | `/api/files/user/:userId?category=` | Admin | Admin lists employee files | ✅ |
| 5 | DELETE | `/api/files/:fileId` | User/Admin | Delete file | ✅ |
| 6 | POST | `/api/files/extract-receipt` | User | Extract single receipt | ✅ |
| 7 | POST | `/api/files/extract-receipts` | User | Batch extract receipts | ✅ |
| 8 | POST | `/api/files/bulk-photos` | Admin | Upload photos from ZIP | ✅ |
| 9 | POST | `/api/files/upload-profile-photo` | User | Upload profile photo | ✅ |
| 10 | POST | `/api/files/fix-photo-urls` | Admin | Migrate profile photos | ✅ |

### Detailed Endpoint Testing

#### Endpoint 1: Upload File

```bash
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "category=document"

# Response:
{
  "id": 1,
  "userId": 5,
  "fileName": "file.pdf",
  "category": "document",
  "driveUrl": "https://drive.google.com/file/d/...",
  "uploadedAt": "2026-03-03T22:39:00Z"
}
```

#### Endpoint 3: List Own Files with Filter

```bash
curl http://localhost:5000/api/files/my?category=receipt \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "files": [
    {
      "id": 2,
      "fileName": "receipt-001.jpg",
      "category": "receipt",
      "driveUrl": "https://...",
      "uploadedAt": "2026-03-03T22:30:00Z"
    }
  ]
}
```

#### Endpoint 6: Single Receipt Extraction

```bash
curl -X POST http://localhost:5000/api/files/extract-receipt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "receipt=@receipt.jpg"

# Response:
{
  "extracted": {
    "vendor": "ABC Stationery",
    "amount": 4500.00,
    "date": "2026-03-01",
    "category": "office_supplies",
    "description": "Office supplies and stationery items",
    "items": [
      { "item": "Pens (pack of 10)", "quantity": 2, "rate": 150 },
      { "item": "Paper (500 sheets)", "quantity": 1, "rate": 400 }
    ],
    "gstNumber": "18AABCT5055K1Z0",
    "invoiceNumber": "INV-2026-001"
  },
  "driveFile": {
    "id": 3,
    "driveUrl": "https://..."
  }
}
```

#### Endpoint 7: Batch Receipt Extraction (MAX 3)

```bash
curl -X POST http://localhost:5000/api/files/extract-receipts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "receipts=@receipt1.jpg" \
  -F "receipts=@receipt2.jpg" \
  -F "receipts=@receipt3.jpg"

# Response:
{
  "results": [
    {
      "fileName": "receipt1.jpg",
      "extracted": { ... },
      "driveFile": { id: 4, driveUrl: "..." }
    },
    {
      "fileName": "receipt2.jpg",
      "extracted": { ... },
      "driveFile": { id: 5, driveUrl: "..." }
    },
    {
      "fileName": "receipt3.jpg",
      "extracted": { ... },
      "driveFile": { id: 6, driveUrl: "..." }
    }
  ]
}
```

#### Endpoint 8: Bulk Photo Upload

```bash
curl -X POST http://localhost:5000/api/files/bulk-photos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "zip=@Close\ up.zip"

# Response:
{
  "uploaded": 63,
  "skipped": 0,
  "errors": [],
  "summary": {
    "total_processed": 63,
    "total_uploaded": 63,
    "failed_uploads": 0,
    "throttle_delay_ms": 200
  }
}
```

---

## Frontend Component Testing

### Test Component: Employee Profile Drive Files Tab

**File:** `client/src/components/employees/EmployeeProfile.jsx` (lines 1085-1250)

**Test Scenarios:**

1. **Display Tests**
   - [ ] Tab appears with FolderOpen icon
   - [ ] All 7 category filters display
   - [ ] Empty state shows appropriate message
   - [ ] Category badges have correct colors

2. **Filtering Tests**
   - [ ] Click "Documents" - shows only document files
   - [ ] Click "Receipts" - shows only receipt files
   - [ ] Click "All" - shows all categories
   - [ ] Filter counts are accurate

3. **Upload Tests**
   - [ ] Upload button visible (admin only)
   - [ ] Non-admin sees upload disabled/hidden
   - [ ] Click upload triggers file picker
   - [ ] File added to list after upload
   - [ ] File size and thumbnail display correctly

4. **Interaction Tests**
   - [ ] Download link opens file in new tab
   - [ ] Delete button shows confirmation
   - [ ] Confirm delete removes file from list
   - [ ] Cancel delete keeps file in list
   - [ ] "Open in Drive" link opens Google Drive

### Test Component: MyFiles Page

**File:** `client/src/components/files/MyFiles.jsx`

**Test Scenarios:**

1. **Drag-and-Drop Upload**
   - [ ] Drag file over drop zone - shows highlight
   - [ ] Drop file - uploads successfully
   - [ ] Progress bar shows during upload
   - [ ] File appears in list after upload

2. **Category Filtering**
   - [ ] Each filter tab works independently
   - [ ] Filtered view updates correctly
   - [ ] File counts per category are accurate
   - [ ] Empty states show for empty categories

3. **File Management**
   - [ ] All files display with thumbnails
   - [ ] File metadata (name, size, date) display
   - [ ] Download works for all file types
   - [ ] Delete shows confirmation dialog
   - [ ] Error messages appear for failed operations

### Test Component: Expense Receipt Upload

**File:** `client/src/components/expenses/MyExpenses.jsx`

**Test Scenarios:**

1. **Upload Validation**
   - [ ] Single file upload works (image or PDF)
   - [ ] Multiple files upload (up to 3)
   - [ ] 4+ files shows error message
   - [ ] File >3MB shows error message
   - [ ] Unsupported file type shows error

2. **Extraction Results**
   - [ ] Results panel appears after upload
   - [ ] Each file shows extracted data
   - [ ] Editable fields for vendor, amount, date
   - [ ] Category auto-populated
   - [ ] Receipt thumbnail displays

3. **Form Integration**
   - [ ] "Apply to Form" fills expense form fields
   - [ ] "Submit All" creates multiple expenses
   - [ ] Receipt URL saved in expense record
   - [ ] Edited values override extraction

---

## Error Handling Verification

### Client-Side Errors (Frontend)

**Errors tested in code:**

1. **File Upload Errors**
   ```javascript
   // Test case: File too large
   - User uploads file >15MB
   - Frontend shows: "File size must be less than 15 MB"
   
   // Test case: Invalid file type
   - User uploads .exe file
   - Frontend shows: "Invalid file type"
   
   // Test case: Upload fails
   - Server returns 500 error
   - Frontend shows: "Upload failed. Try again."
   ```

2. **Extraction Errors**
   ```javascript
   // Test case: Too many files
   - User uploads 4 receipts
   - Shows: "Maximum 3 files allowed for batch extraction"
   
   // Test case: File too large
   - User uploads receipt >3MB
   - Shows: "Receipt files must be less than 3 MB each"
   ```

3. **Access Control Errors**
   ```javascript
   // Test case: Non-admin tries to upload for employee
   - Shows: "You don't have permission to upload files for other users"
   
   // Test case: User tries to delete other's file
   - Shows: "You don't have permission to delete this file"
   ```

### Server-Side Errors (Backend)

**Handled in `server/src/routes/files.js`:**

1. **Validation Errors (400)**
   ```
   - Missing required fields
   - Invalid category value
   - File count exceeds limits
   - File size exceeds limits
   - Invalid user ID format
   ```

2. **Authentication Errors (401)**
   ```
   - Missing authentication token
   - Expired token
   - Invalid token signature
   ```

3. **Authorization Errors (403)**
   ```
   - Non-admin accessing admin endpoints
   - User accessing other user's files
   - User deleting other user's files
   ```

4. **Not Found Errors (404)**
   ```
   - File not found in database
   - User not found
   - File not found on Google Drive
   ```

5. **Conflict Errors (409)**
   ```
   - Duplicate file entry
   - File already exists on Drive
   ```

6. **Server Errors (500)**
   ```
   - Google Drive API failures
   - Gemini API failures
   - Database operation failures
   - ZIP processing failures
   ```

---

## Performance Considerations

### File Upload Optimization

- **Multer Configuration**: Memory storage with 15MB limit per file
- **Chunking**: Not implemented (files <15MB upload as single request)
- **Compression**: Frontend should compress large images before upload
- **Throttling**: 200ms delay between Drive API calls in bulk upload

### Google Drive API Quotas

- **Daily Quota**: 1 million read requests per day
- **Queries per User**: 10 per second per user
- **Batch Operations**: Up to 100 requests per batch
- **Sharing Updates**: 1 per file (done immediately after upload)

**Mitigation:**
- Bulk photo upload throttles to 200ms per file (5 files/second max)
- Receipt extraction batches up to 3 files per request
- Caching of root folder ID to avoid redundant API calls

### Database Performance

- **Indexes**: userId, category, combined userId+category
- **Query Optimization**: 
  - Most queries filter by userId first
  - Category filter uses index for quick lookup
  - Pagination implemented for large result sets

### Frontend Performance

- **Lazy Loading**: MyFiles component lazy-loaded via React.lazy()
- **Image Optimization**: Thumbnails served from Google Drive cache
- **State Management**: useApi hook prevents multiple concurrent uploads
- **Error Recovery**: Failed uploads can be retried without reloading

### Monitoring & Logging

- **API Response Times**: Logged for uploads >10MB
- **Google Drive Errors**: Logged with friendly message for user
- **Failed Extractions**: Logged with input file details
- **Quota Usage**: Tracked in metrics (can add monitoring)

---

## Deployment Checklist

### Before Going to Production

- [ ] **Environment Variables Set**
  ```bash
  DATABASE_URL=file:./prod.db
  JWT_SECRET=<strong-random-string>
  NODE_ENV=production
  GOOGLE_CREDENTIALS=<base64-encoded-service-account>
  ```

- [ ] **Database Migration**
  ```bash
  # Run migrations
  cd server
  npx prisma migrate deploy
  
  # Verify schema
  npx prisma db execute --stdin < verify-schema.sql
  ```

- [ ] **Backend Build & Test**
  ```bash
  cd server
  npm install --production
  npm run start
  # Verify server runs without errors
  ```

- [ ] **Frontend Build & Test**
  ```bash
  cd client
  npm install --production
  npm run build
  # Verify dist/ folder created
  npm run preview
  ```

- [ ] **Security Audit**
  - [ ] No hardcoded credentials in code
  - [ ] No console.log() calls with sensitive data
  - [ ] All user inputs validated
  - [ ] CORS configured properly
  - [ ] HTTPS enforced (if applicable)

- [ ] **Performance Testing**
  - [ ] Backend response times <500ms for typical requests
  - [ ] File upload <5MB completes in <5 seconds
  - [ ] Bulk photo upload <50MB completes in <1 minute
  - [ ] Database queries optimized (check slow query log)

- [ ] **Integration Testing**
  - [ ] API endpoints respond correctly
  - [ ] Frontend calls correct endpoints
  - [ ] File uploads reach Google Drive successfully
  - [ ] Profile photos update correctly
  - [ ] Receipts extract data successfully
  - [ ] Bulk photos match employees correctly

- [ ] **Monitoring Setup**
  - [ ] Error logging configured
  - [ ] Performance monitoring enabled
  - [ ] API usage tracking setup
  - [ ] Backup strategy for database
  - [ ] Backup strategy for Google Drive files

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Server Won't Start

**Error:** `Port 5000 already in use`
```bash
# Solution: Kill process using port 5000
# Windows (cmd):
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or use different port:
PORT=5001 npm run dev
```

**Error:** `Cannot find module 'googleapis'`
```bash
# Solution: Install dependencies
cd server
npm install
```

**Error:** `Prisma engine missing`
```bash
# Solution: Generate Prisma client
cd server
npx prisma generate
```

#### 2. Google Drive API Errors

**Error:** `Invalid Service Account credentials`
```bash
# Solution: Verify google-service-account.json
- Check file exists: server/google-service-account.json
- Verify JSON is valid: cat server/google-service-account.json | jq .
- Check private_key field is present and valid
- Check service account email has Drive API enabled
```

**Error:** `Permission denied when uploading`
```bash
# Solution: Check Drive API permissions
- Service account has Drive API enabled
- Service account has Editor role on shared Drive (if using)
- Quota not exceeded (check Google Cloud Console)
```

**Error:** `Folder not found in Drive`
```bash
# Solution: Recreate root folder
1. Manually create "CPIPL HR Files" folder in Service Account's Drive
2. Call POST /api/files/fix-photo-urls to resync
3. Verify folder ID in database
```

#### 3. File Upload Failures

**Error:** `413 Payload Too Large`
```bash
# Solution: Check file size limits
- Individual files must be <15MB
- Multer limit set to 15MB in route handler
- Check nginx/reverse proxy limits if behind proxy
```

**Error:** `File upload succeeds but doesn't appear in list`
```bash
# Solution: Check database record
1. Verify DriveFile table has entry: SELECT * FROM DriveFile WHERE fileName='...'
2. Check that userId is correct
3. Verify driveFileId is present and unique
4. Verify uploadedAt timestamp is recent
```

**Error:** `File appears in list but link is broken`
```bash
# Solution: Verify Google Drive sharing
1. Check driveUrl is correctly formed
2. Verify file has anyoneWithLink=reader sharing
3. Try opening link in incognito window (avoid auth cache)
4. Check file is not soft-deleted in Drive
```

#### 4. Receipt Extraction Issues

**Error:** `Gemini API returns empty extraction`
```bash
# Solution: Verify request format
- File format is supported (JPEG, PNG, WebP, PDF)
- File size <20MB (soft limit for Gemini)
- Image quality is sufficient for OCR
- Text in document is not rotated >45 degrees
```

**Error:** `Extracted data is incomplete`
```bash
# Solution: Improve document quality
- Ensure receipt is well-lit and in focus
- Vendor name should be clearly visible
- Amount should be highlighted/obvious
- Date should be legible
- Try different image format (PDF vs JPG)
```

**Error:** `Batch extraction fails on 2nd file`
```bash
# Solution: Check file limits
- Max 3 files per batch
- Max 3MB per file (total batch <9MB)
- Supported MIME types only
- No corrupted files in batch
```

#### 5. Database Issues

**Error:** `UNIQUE constraint failed: driveFileId`
```bash
# Solution: Check for duplicate entries
1. Find duplicates: SELECT driveFileId, COUNT(*) FROM DriveFile GROUP BY driveFileId HAVING COUNT(*) > 1
2. Delete duplicates keeping latest: DELETE FROM DriveFile WHERE id NOT IN (SELECT MAX(id) FROM DriveFile GROUP BY driveFileId)
3. Verify schema has unique constraint on driveFileId
```

**Error:** `Foreign key constraint violation`
```bash
# Solution: Verify user exists
- Don't delete users with files in Drive
- Use soft delete for users if implementing
- Cascade delete DriveFile records on user delete
```

**Error:** `Database locked` or `SQLITE_BUSY`
```bash
# Solution: Close concurrent connections
- Kill other Prisma Studio sessions
- Close other database clients
- Restart server
- Check for long-running queries
```

#### 6. Frontend Issues

**Error:** `Files list doesn't update after upload`
```bash
# Solution: Verify refetch mechanism
1. Check that useApi hook is used (not manual fetch)
2. Verify success callback triggers refetch
3. Check browser console for errors
4. Try refreshing page (Ctrl+R)
```

**Error:** `Category filter not working`
```bash
# Solution: Check filter implementation
1. Verify category values match backend enum
2. Check that API includes category parameter
3. Inspect network request to verify parameter sent
4. Verify backend filter logic
```

**Error:** `Upload button not appearing for admin`
```bash
# Solution: Check admin role
1. Verify user has role='admin' in database
2. Check that authentication token is valid
3. Verify frontend checks req.user.role correctly
4. Check browser console for errors
```

#### 7. Performance Issues

**Issue:** `File upload is very slow (>30 seconds)`
```bash
# Solutions:
- Check network bandwidth (should be >1Mbps)
- Compress image files before upload
- Check Google Drive API quota usage
- Verify no rate limiting from Drive API
- Check database write performance
```

**Issue:** `Bulk photo upload takes >5 minutes for 100 photos`
```bash
# Solutions:
- Verify throttle delay is reasonable (200ms)
- Check network bandwidth
- Verify server CPU not maxed out
- Check Drive API quota usage
- Monitor database transactions

# Acceptable times:
- 100 photos x 200KB = 20MB
- 200ms throttle x 100 files = 20 seconds
- + upload time ~10 seconds
- Total expected: ~30 seconds
```

**Issue:** `Dashboard is slow when showing many files`
```bash
# Solutions:
- Implement pagination (default 20 files per page)
- Add lazy loading for thumbnails
- Use database indexes for queries
- Cache folder structures
- Use CDN for image thumbnails
```

---

## Performance Metrics

### Expected Response Times

| Operation | Expected Time | Acceptable Range |
|-----------|---------------|------------------|
| GET /my | <200ms | <500ms |
| POST /upload (5MB) | 3-5s | <10s |
| POST /extract-receipt | 2-3s | <5s |
| POST /bulk-photos (10) | 2-3s | <10s |
| DELETE /:fileId | <100ms | <500ms |
| GET /user/:userId | <200ms | <500ms |

### File Size Limits

| File Type | Limit | Purpose |
|-----------|-------|---------|
| General uploads | 15MB | Prevent server memory issues |
| Receipt/Invoice | 3MB | Gemini API constraints |
| Profile Photo | 5MB | Display performance |
| Bulk ZIP | 200MB | Prevent memory exhaustion |
| Individual in ZIP | 15MB | Consistent with single upload |

### Database Performance

| Query | Expected Time | Index |
|-------|---------------|-------|
| Find files by userId | <50ms | userId |
| Filter by category | <30ms | category |
| Get user's receipts | <50ms | userId, category |
| List all files | <100ms | None (large result) |

---

## Additional Resources

### Related Documentation

- **Database Schema**: `server/prisma/schema.prisma`
- **Implementation Complete Doc**: `GOOGLE_DRIVE_IMPLEMENTATION_COMPLETE.md`
- **Drive Files Tab Verification**: `DRIVE_FILES_TAB_VERIFICATION.md`
- **Test Scripts**:
  - `server/test-drive-files-tab.js`
  - `server/test-bulk-photo-upload.js`
  - `server/test-receipt-extraction.js`

### Key Files

**Backend:**
- `server/src/routes/files.js` - All endpoints (418 lines)
- `server/src/services/google/googleDrive.js` - Drive API (227 lines)
- `server/src/services/invoiceExtractor.js` - Extraction service

**Frontend:**
- `client/src/components/employees/EmployeeProfile.jsx` - Profile tab (1289 lines)
- `client/src/components/files/MyFiles.jsx` - File portal
- `client/src/components/expenses/MyExpenses.jsx` - Expense receipt upload

**Database:**
- `server/prisma/schema.prisma` - Data models
- `server/prisma/dev.db` - SQLite database file

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-03 | Initial comprehensive guide for testing and deployment |

---

**Status:** ✅ READY FOR TESTING & DEPLOYMENT
**Last Verified:** 2026-03-03
**Next Steps:** Execute test scripts, verify functionality, deploy to production
