# Asset Repair System - Deployment & API Documentation

**Version:** 1.0  
**Date:** March 5, 2026  
**Status:** Production Ready  
**Last Updated:** March 5, 2026

---

## Table of Contents

1. [API Documentation](#api-documentation)
2. [Deployment Checklist](#deployment-checklist)
3. [Configuration Guide](#configuration-guide)
4. [Troubleshooting](#troubleshooting)
5. [Rollback Procedures](#rollback-procedures)
6. [Performance Guidelines](#performance-guidelines)

---

## API Documentation

### Base URL
```
Development:  http://localhost:5000/api/assets
Production:   https://cpipl-hr.com/api/assets
```

### Authentication
All endpoints require Bearer token in Authorization header:
```
Authorization: Bearer {jwt_token}
```

### Error Responses
All endpoints return standard error format:
```json
{
  "message": "Error description",
  "status": 400|401|403|404|409|500,
  "details": {} // Optional additional info
}
```

---

### 1. Initiate Asset Repair

**Endpoint:** `POST /repairs/:assetId/initiate`

**Authentication:** Required (Admin only)

**Parameters:**
- `assetId` (URL param, required): Asset ID (number)

**Request Body:**
```json
{
  "repairType": "maintenance|repair|inspection|calibration",
  "sentOutDate": "2026-03-05",
  "expectedReturnDate": "2026-03-15",
  "vendor": "Tech Solutions (optional)",
  "vendorPhone": "9876543210 (optional)",
  "vendorEmail": "vendor@email.com (optional, must be valid email)",
  "vendorLocation": "Downtown (optional)",
  "estimatedCost": 5000 (optional, must be > 0),
  "issueDescription": "Detailed issue description (optional)",
  "notes": "Additional notes (optional)"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "assetId": 100,
  "repairType": "maintenance",
  "status": "initiated",
  "sentOutDate": "2026-03-05",
  "expectedReturnDate": "2026-03-15",
  "vendor": "Tech Solutions",
  "estimatedCost": 5000,
  "initiatedBy": 1,
  "createdAt": "2026-03-05T10:00:00Z",
  "asset": {
    "id": 100,
    "name": "Laptop A",
    "serialNumber": "LAP-001"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or invalid data
- `404 Not Found` - Asset not found
- `409 Conflict` - Asset already in repair

**Validation Rules:**
- `repairType`: Must be one of the enum values
- `sentOutDate` must be before `expectedReturnDate`
- `estimatedCost` must be positive if provided
- `vendorEmail` must be valid email format if provided

---

### 2. Get Active Repair for Asset

**Endpoint:** `GET /repairs/:assetId`

**Authentication:** Required

**Parameters:**
- `assetId` (URL param, required): Asset ID (number)

**Response (200 OK):**
```json
{
  "id": 1,
  "assetId": 100,
  "repairType": "maintenance",
  "status": "in_progress",
  "sentOutDate": "2026-03-05",
  "expectedReturnDate": "2026-03-15",
  "daysOverdue": 0,
  "vendor": "Tech Solutions",
  "estimatedCost": 5000,
  "timeline": [
    {
      "id": 1,
      "oldStatus": null,
      "newStatus": "initiated",
      "changedAt": "2026-03-05T10:00:00Z"
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "message": "No active repair found for this asset"
}
```

---

### 3. List All Repairs

**Endpoint:** `GET /repairs`

**Authentication:** Required (Admin)

**Query Parameters:**
```
?status=initiated          (optional: filter by status)
?assetId=100              (optional: filter by asset)
?initiatedBy=1            (optional: filter by user)
?limit=20                 (optional: default 20, max 100)
?offset=0                 (optional: pagination)
```

**Response (200 OK):**
```json
{
  "repairs": [
    {
      "id": 1,
      "assetId": 100,
      "asset": { "name": "Laptop A", "serialNumber": "LAP-001" },
      "repairType": "maintenance",
      "status": "in_progress",
      "daysOverdue": 0,
      "vendor": "Tech Solutions",
      "createdAt": "2026-03-05T10:00:00Z"
    },
    // ... more repairs
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**Status Values:**
- `initiated` - Just created
- `in_transit` - Being transported to vendor
- `in_progress` - Being repaired
- `ready_for_pickup` - Repair complete, awaiting pickup
- `completed` - Repair finished and returned
- `cancelled` - Repair cancelled

---

### 4. Update Repair Status

**Endpoint:** `PUT /repairs/:repairId/update-status`

**Authentication:** Required (Admin)

**Parameters:**
- `repairId` (URL param, required): Repair ID (number)

**Request Body:**
```json
{
  "newStatus": "in_transit|in_progress|ready_for_pickup|completed|cancelled",
  "notes": "Status change notes (optional)"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "status": "in_transit",
  "previousStatus": "initiated",
  "timeline": {
    "id": 2,
    "repairId": 1,
    "oldStatus": "initiated",
    "newStatus": "in_transit",
    "changedBy": 1,
    "changedAt": "2026-03-05T14:30:00Z",
    "notes": "Sent to vendor"
  }
}
```

**Valid Transitions:**
```
initiated       → in_transit, cancelled
in_transit      → in_progress, cancelled
in_progress     → ready_for_pickup, cancelled
ready_for_pickup → completed, in_progress (backtrack)
completed       → (no transitions)
cancelled       → (no transitions)
```

**Error Response (400):**
```json
{
  "message": "Cannot transition from completed to in_progress"
}
```

---

### 5. List Overdue Repairs

**Endpoint:** `GET /repairs/overdue`

**Authentication:** Required (Admin)

**Query Parameters:**
```
?days=7                (optional: repairs overdue by X days or more)
?limit=50              (optional: default 50)
?sortBy=daysOverdue    (optional: sort field)
?sortOrder=desc        (optional: asc|desc)
```

**Response (200 OK):**
```json
{
  "overdue": [
    {
      "id": 2,
      "assetId": 200,
      "asset": { "name": "Printer B" },
      "status": "in_progress",
      "expectedReturnDate": "2026-02-28",
      "daysOverdue": 5,
      "urgency": "alert",
      "vendor": "Quick Repairs"
    },
    {
      "id": 3,
      "assetId": 300,
      "asset": { "name": "Monitor C" },
      "status": "initiated",
      "expectedReturnDate": "2026-01-01",
      "daysOverdue": 63,
      "urgency": "critical",
      "vendor": "Tech Solutions"
    }
  ],
  "total": 2
}
```

**Urgency Levels:**
- `normal` - 0 days overdue
- `alert` - 1-7 days overdue (orange)
- `warning` - 8-14 days overdue (yellow)
- `critical` - 15+ days overdue (red)

---

### 6. Complete Repair

**Endpoint:** `POST /repairs/:repairId/complete`

**Authentication:** Required (Admin)

**Parameters:**
- `repairId` (URL param, required): Repair ID (number)

**Request Body:**
```json
{
  "actualReturnDate": "2026-03-15",
  "actualCost": 5000,
  "condition": "good|fair|poor",
  "handoverNotes": "Asset in perfect condition",
  "checkedBy": 1 (optional, defaults to current user)
}
```

**Response (200 OK):**
```json
{
  "repair": {
    "id": 1,
    "status": "completed",
    "actualReturnDate": "2026-03-15",
    "actualCost": 5000,
    "daysInRepair": 10,
    "costDifference": 0,
    "costOverrunPercentage": 0
  },
  "handover": {
    "id": 5,
    "assetId": 100,
    "handoverFrom": "Tech Solutions",
    "handoverDate": "2026-03-15",
    "condition": "good",
    "handoverNotes": "Asset in perfect condition"
  }
}
```

**Side Effects:**
- Asset status changed to `available`
- AssetHandover record created
- Repair status changed to `completed`
- Timeline entry recorded
- Asset becomes available for assignment

**Requirements:**
- Repair must be in `ready_for_pickup` status
- `actualReturnDate` must be >= `sentOutDate`
- `actualCost` must be >= 0 if provided

---

### 7. Get Repair History/Timeline

**Endpoint:** `GET /repairs/:assetId/timeline`

**Authentication:** Required

**Parameters:**
- `assetId` (URL param, required): Asset ID (number)

**Query Parameters:**
```
?repairId=1    (optional: specific repair, defaults to latest)
?limit=50      (optional: max entries)
```

**Response (200 OK):**
```json
{
  "repair": {
    "id": 1,
    "assetId": 100,
    "asset": { "name": "Laptop A" }
  },
  "timeline": [
    {
      "id": 1,
      "repairId": 1,
      "oldStatus": null,
      "newStatus": "initiated",
      "changedBy": {
        "id": 1,
        "name": "John Admin"
      },
      "changedAt": "2026-03-05T10:00:00Z",
      "notes": null
    },
    {
      "id": 2,
      "repairId": 1,
      "oldStatus": "initiated",
      "newStatus": "in_transit",
      "changedBy": {
        "id": 1,
        "name": "John Admin"
      },
      "changedAt": "2026-03-05T14:30:00Z",
      "notes": "Sent to vendor"
    }
  ]
}
```

---

### 8. Edit Repair Details

**Endpoint:** `PUT /repairs/:repairId/edit`

**Authentication:** Required (Admin)

**Parameters:**
- `repairId` (URL param, required): Repair ID (number)

**Request Body:**
```json
{
  "vendor": "Updated Vendor (optional)",
  "vendorPhone": "9999999999 (optional)",
  "vendorEmail": "new@vendor.com (optional)",
  "vendorLocation": "New Location (optional)",
  "estimatedCost": 6000 (optional, must be > 0),
  "issueDescription": "Updated description (optional)",
  "notes": "Updated notes (optional)"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "vendor": "Updated Vendor",
  "vendorPhone": "9999999999",
  "vendorEmail": "new@vendor.com",
  "estimatedCost": 6000,
  "issueDescription": "Updated description",
  "notes": "Updated notes"
}
```

**Restrictions:**
- Cannot edit if repair is `completed` or `cancelled`
- Cannot edit `status`, `sentOutDate`, or `expectedReturnDate` via this endpoint
- Phone must be valid format if provided
- Email must be valid format if provided

---

## Deployment Checklist

### Pre-Deployment Phase

#### Code Review
- [ ] All tests passing locally
- [ ] Code review completed and approved
- [ ] No linting errors or warnings
- [ ] No console.log or debug statements left
- [ ] No hardcoded credentials or sensitive data

#### Database
- [ ] Backup created of production database
- [ ] Migration scripts tested locally
- [ ] Schema changes verified
- [ ] Indexes created for performance
- [ ] Foreign key relationships validated

#### Testing
- [ ] Unit tests: 42/42 passing
- [ ] Integration tests: 38+/38+ passing
- [ ] Component tests: 47/47 passing
- [ ] E2E scenarios tested manually
- [ ] Performance tests passing
- [ ] Security review completed

#### Documentation
- [ ] API endpoints documented
- [ ] Code comments added
- [ ] README updated
- [ ] Deployment guide prepared
- [ ] Rollback procedure documented

### Deployment Phase

#### Pre-Flight Checks
- [ ] Production database backup created
- [ ] Environment variables verified
- [ ] API keys configured
- [ ] Database connection tested
- [ ] All external services available

#### Deployment Steps
1. [ ] Run database migration: `npx prisma migrate deploy`
2. [ ] Verify migration completed successfully
3. [ ] Deploy backend: `npm run build && npm start`
4. [ ] Wait for backend to be ready (health check)
5. [ ] Deploy frontend: `npm run build && npm run serve`
6. [ ] Wait for frontend to load
7. [ ] Smoke test key workflows

#### Verification
- [ ] All API endpoints responding
- [ ] Database queries executing
- [ ] Files accessible from storage
- [ ] Email notifications working
- [ ] Performance metrics normal
- [ ] Error rates acceptable

#### Monitoring
- [ ] Enable application monitoring
- [ ] Set up alert notifications
- [ ] Start collecting performance metrics
- [ ] Monitor error logs
- [ ] Check user feedback channels

### Post-Deployment Phase

#### Validation (First 24 hours)
- [ ] No increase in error rates
- [ ] API response times normal
- [ ] Database performance stable
- [ ] User workflow completion rates normal
- [ ] No negative user feedback

#### Monitoring (First Week)
- [ ] Daily health checks passing
- [ ] No critical issues reported
- [ ] Performance metrics stable
- [ ] All features functioning correctly
- [ ] Backup and recovery tested

#### Long-term Monitoring
- [ ] Weekly performance reports
- [ ] Monthly security audits
- [ ] Quarterly disaster recovery drills
- [ ] Continuous optimization

---

## Configuration Guide

### Environment Variables

Create `.env` file in server directory:

```bash
# Database
DATABASE_URL="file:./dev.db"

# Server
NODE_ENV="production"
PORT=5000
JWT_SECRET="your-super-secret-key"

# Email (if enabled)
GMAIL_USER="your-gmail@gmail.com"
GMAIL_PASS="your-app-password"

# Google Services (optional)
GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY="{...json...}"
GOOGLE_GENERATIVE_AI_API_KEY="your-api-key"
```

### Database Configuration

#### SQLite (Development)
```bash
DATABASE_URL="file:./prisma/dev.db"
```

#### PostgreSQL (Production)
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/cpipl_db"
```

#### MySQL
```bash
DATABASE_URL="mysql://user:password@localhost:3306/cpipl_db"
```

### Prisma Setup

```bash
# Initialize
npx prisma init

# Push schema changes
npx prisma db push

# Run migrations
npx prisma migrate deploy

# View database
npx prisma studio
```

---

## Troubleshooting

### Issue 1: Migration Fails

**Error:** `Failed to apply pending migrations`

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --rolled-back <migration_name>

# Retry migration
npx prisma migrate deploy
```

---

### Issue 2: API Returns 404 for Created Repair

**Error:** Repair created but not found on list

**Solution:**
1. Check database connection
2. Verify Prisma client regenerated: `npx prisma generate`
3. Check if asset exists before creating repair
4. Review database logs for errors

---

### Issue 3: Status Update Fails with Validation Error

**Error:** `Cannot transition from X to Y`

**Solution:**
1. Check valid transitions documented above
2. Verify repair status before update
3. Review error message for specific reason
4. Check if repair is in terminal state (completed/cancelled)

---

### Issue 4: Performance Degradation with Large Datasets

**Error:** List repairs endpoint slow with 1000+ records

**Solution:**
```bash
# Create index for performance
npx prisma migrate dev --name add_repair_indexes

# Verify indexes
SELECT * FROM sqlite_master WHERE type='index' AND name LIKE 'AssetRepair%';

# Use pagination
GET /api/assets/repairs?limit=20&offset=0
```

---

### Issue 5: Email Notifications Not Sending

**Error:** Vendor emails not delivered

**Solution:**
1. Verify email service configured in `.env`
2. Check Gmail "Less secure app" access enabled
3. Review email logs for errors
4. Test email service directly

---

### Issue 6: Detail Panel Sticky Header Positioning

**Error:** Header overlaps content on scroll

**Solution:**
1. Check z-index value: should be `z-10`
2. Verify `top-0` class applied
3. Clear browser cache
4. Check for conflicting CSS

---

## Rollback Procedures

### If Deployment Fails

#### Step 1: Halt Services
```bash
# Stop application
systemctl stop cpipl-hr-api
systemctl stop cpipl-hr-web
```

#### Step 2: Check Status
```bash
# Verify services stopped
systemctl status cpipl-hr-api
systemctl status cpipl-hr-web

# Check application logs
tail -100 /var/log/cpipl-hr-api.log
```

#### Step 3: Rollback Database
```bash
# If migration failed:
npx prisma migrate resolve --rolled-back <migration_name>

# If data corrupted:
psql < /backup/database.sql  # Restore from backup
```

#### Step 4: Restore Previous Version
```bash
# Checkout previous commit
git checkout HEAD~1

# Reinstall dependencies
npm install --production

# Rebuild
npm run build
```

#### Step 5: Restart Services
```bash
# Start services
systemctl start cpipl-hr-api
systemctl start cpipl-hr-web

# Verify services running
curl http://localhost:5000/api/health
curl http://localhost:3000/health
```

#### Step 6: Notify Team
- Send alert to team
- Document rollback reason
- Schedule incident review
- Create action items for prevention

---

## Performance Guidelines

### Response Time Targets

| Endpoint | Operation | Target | Actual |
|----------|-----------|--------|--------|
| POST /repairs/:assetId/initiate | Create | < 1s | TBD |
| GET /repairs | List (20 items) | < 500ms | TBD |
| GET /repairs/:assetId | Get active | < 200ms | TBD |
| PUT /repairs/:repairId/update-status | Update status | < 500ms | TBD |
| GET /repairs/overdue | List overdue | < 1s | TBD |
| POST /repairs/:repairId/complete | Complete | < 1s | TBD |

### Database Query Optimization

```sql
-- Most frequently called query
SELECT r.*, a.name, a.serialNumber 
FROM AssetRepair r
JOIN Asset a ON r.assetId = a.id
WHERE r.assetId = ?
LIMIT 1;

-- Index should exist:
CREATE INDEX idx_AssetRepair_assetId ON AssetRepair(assetId);
```

### Caching Strategy

```
GET /repairs           → Cache 1 minute (admin view)
GET /repairs/:assetId  → Cache 5 minutes (user view)
GET /repairs/overdue   → Cache 30 minutes (less critical)
```

### Load Testing

```
Test Scenario: 100 concurrent users
- 50% listing repairs
- 30% updating status
- 20% viewing details

Expected Result:
- P95 response time: < 2 seconds
- Error rate: < 0.1%
- No database connection pool exhaustion
```

---

## Deployment Sign-Off

### System Requirements
- ✅ Node.js 16+ installed
- ✅ PostgreSQL/MySQL or SQLite available
- ✅ 2GB RAM minimum
- ✅ 100MB disk space minimum
- ✅ Internet connection for external services

### Pre-Deployment Verification
- ✅ All tests passing
- ✅ Code review completed
- ✅ Database backup created
- ✅ Deployment plan reviewed
- ✅ Team notified

### Deployment Window
- **Date:** [To be scheduled]
- **Start Time:** [TBD]
- **Estimated Duration:** 30 minutes
- **Rollback Available:** Yes (within 1 hour)

### Sign-Off
- **Approved By:** [Department Head]
- **Deployed By:** [DevOps Engineer]
- **Verified By:** [QA Engineer]
- **Date:** [To be recorded]

---

## Support & Escalation

### Issues During Deployment
- **Critical:** Page alerts, instant escalation
- **Major:** Email alert, 15 min response
- **Minor:** Logged for next review cycle

### Post-Deployment Support
- **First 24 hours:** 24/7 monitoring
- **Week 1:** Daily health checks
- **Week 2+:** Standard monitoring

### Contact Information
- **On-call Engineer:** [Phone number]
- **DevOps Lead:** [Email]
- **Database Admin:** [Email]

---

**Document Status:** FINAL  
**Last Review:** March 5, 2026  
**Next Review:** April 5, 2026

---

## Appendix A: Quick Reference

### Create Repair
```bash
curl -X POST http://localhost:5000/api/assets/repairs/100/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repairType":"maintenance","sentOutDate":"2026-03-05","expectedReturnDate":"2026-03-15"}'
```

### Update Status
```bash
curl -X PUT http://localhost:5000/api/assets/repairs/1/update-status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"in_transit"}'
```

### List Overdue
```bash
curl -X GET "http://localhost:5000/api/assets/repairs/overdue?days=7" \
  -H "Authorization: Bearer TOKEN"
```

---

**END OF DEPLOYMENT DOCUMENTATION**

