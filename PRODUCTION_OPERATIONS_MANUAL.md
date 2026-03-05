# Production Operations Manual
## CPIPL HR System - Operational Excellence Guide

**Version:** 1.0  
**Date:** March 5, 2026  
**Scope:** Asset Repair System (Plan 2) + Broader HR Platform  
**Audience:** Operations Team, DevOps, Support Engineers, Incident Responders  

---

## Table of Contents

1. [Monitoring & Alerting Setup](#monitoring--alerting-setup)
2. [Operational Runbooks](#operational-runbooks)
3. [Performance Baselines](#performance-baselines)
4. [Incident Response Procedures](#incident-response-procedures)
5. [Health Check & Diagnostics](#health-check--diagnostics)
6. [Log Analysis & Troubleshooting](#log-analysis--troubleshooting)
7. [Disaster Recovery Procedures](#disaster-recovery-procedures)
8. [Capacity Planning](#capacity-planning)

---

## Monitoring & Alerting Setup

### 1. Application Health Monitoring

#### Health Check Endpoints (Built-in)
```bash
# Backend health
GET http://localhost:5000/api/health
Response: { "status": "healthy", "timestamp": "2026-03-05T10:30:00Z" }

# Frontend health
GET http://localhost:3000/health
Response: { "status": "ok", "version": "1.0.0" }

# Database health
GET http://localhost:5000/api/health/db
Response: { "database": "connected", "migrations": "up-to-date" }
```

#### Recommended Monitoring Tools

**Option A: Free/Open Source**
```yaml
# docker-compose monitoring stack
services:
  prometheus:
    image: prom/prometheus:latest
    ports: [9090:9090]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana:latest
    ports: [3000:3000]
    depends_on: [prometheus]
```

**Option B: Cloud (AWS CloudWatch)**
```bash
# Use AWS CloudWatch natively
# Metrics: CPU, Memory, Disk, Network I/O
# Logs: Centralized log aggregation
# Alarms: Automatic notifications
```

**Option C: Hybrid (Datadog, New Relic, etc.)**
```bash
# Professional SaaS with advanced features
# Includes: Distributed tracing, error tracking, performance monitoring
```

### 2. Key Metrics to Monitor

#### Backend Metrics (Node.js)
```
api.request.duration.ms
  - p50: < 50ms
  - p95: < 200ms
  - p99: < 500ms
  Alert if: p95 > 300ms for 5+ minutes

api.response.errors
  - Count of 4xx and 5xx responses
  Alert if: > 1% of requests returning errors

api.database.query.duration.ms
  - Prisma query timing
  Alert if: Median > 100ms

nodejs.memory.usage
  - Heap used / Heap max
  Alert if: > 80% of max heap

nodejs.event_loop.lag
  - Event loop latency
  Alert if: > 100ms (indicates blocking)
```

#### Database Metrics (SQLite)
```
db.file.size.mb
  - Database file size
  Alert if: > 1GB (check if cleanup needed)

db.connection.count
  - Active connections
  Alert if: All connections in use

db.transaction.duration.ms
  - Write transaction timing
  Alert if: > 500ms (indicates lock contention)

db.backup.status
  - Last successful backup time
  Alert if: > 24 hours since last backup
```

#### Frontend Metrics
```
frontend.page.load.ms
  - Time to interactive
  Target: < 3 seconds
  Alert if: > 5 seconds

frontend.api.response.time.ms
  - API call latency from client
  Target: < 1 second
  Alert if: > 2 seconds

frontend.error.count
  - JavaScript errors
  Alert if: > 5 per minute

frontend.bundle.size.kb
  - Total JS bundle size
  Monitor for regressions
```

#### Asset Repair Specific Metrics
```
repairs.overdue.count
  - Number of repairs overdue
  Alert if: > 3 overdue repairs

repairs.in_progress.count
  - Count of repairs in progress
  Normal range: 5-20

repairs.cost.variance.percent
  - (Actual - Estimated) / Estimated
  Alert if: > 30% variance for single repair

repairs.completion.rate.percent
  - Completed vs. initiated
  Target: > 95%
  Alert if: < 90%
```

### 3. Alert Configuration Examples

#### Prometheus Alert Rules
```yaml
# prometheus-rules.yml
groups:
  - name: api_health
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "{{ $value | humanizePercentage }} of requests are failing"
      
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.3
        for: 5m
        annotations:
          summary: "API response time degraded"
          description: "p95 response time is {{ $value }} seconds"
      
      - alert: DatabaseConnectionPoolExhausted
        expr: db_connections_in_use / db_connections_max > 0.9
        for: 2m
        annotations:
          summary: "Database connection pool nearly full"
          description: "{{ humanize $value }} connections in use"

  - name: asset_repair
    interval: 60s
    rules:
      - alert: ExcessiveRepairOverdues
        expr: repairs_overdue_count > 5
        for: 2m
        annotations:
          summary: "Multiple repairs overdue"
          description: "{{ $value }} repairs are overdue"
```

### 4. Notification Channels

#### Email Alerts
```javascript
// server/src/config/monitoring.js
const ALERT_CONFIG = {
  email: {
    enabled: true,
    recipients: ['ops@cpipl.com', 'devops@cpipl.com'],
    severityThreshold: 'warning', // Send for warning and above
    rateLimit: '5min', // Max 1 email per 5 minutes per alert type
  }
};
```

#### Slack Alerts
```javascript
const ALERT_CONFIG = {
  slack: {
    enabled: true,
    webhookUrl: process.env.SLACK_ALERT_WEBHOOK,
    channels: {
      critical: '#incident-response',
      warning: '#ops-alerts',
      info: '#ops-info'
    },
    mentionOnCritical: ['@devops-oncall', '@team-lead'],
  }
};
```

#### PagerDuty Integration (Critical Only)
```javascript
const ALERT_CONFIG = {
  pagerduty: {
    enabled: true,
    integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
    triggerOn: ['critical', 'severe-degradation'],
  }
};
```

---

## Operational Runbooks

### Runbook 1: Database Backup & Recovery

#### Daily Backup Procedure

**Schedule:** 2:00 AM UTC daily (off-peak)

```bash
#!/bin/bash
# server/scripts/backup-database.sh

BACKUP_DIR="/backups/cpipl-hr"
DB_FILE="/app/server/prisma/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/cpipl_hr_$TIMESTAMP.db"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Copy database file
cp $DB_FILE $BACKUP_FILE

# Verify backup integrity
sqlite3 $BACKUP_FILE "PRAGMA integrity_check;" > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $BACKUP_FILE"
  
  # Compress for storage
  gzip $BACKUP_FILE
  
  # Upload to cloud storage (S3)
  aws s3 cp "$BACKUP_FILE.gz" "s3://cpipl-backups/$(date +%Y/%m)/"
  
  # Clean up old backups (keep 30 days)
  find $BACKUP_DIR -name "*.db.gz" -mtime +30 -delete
else
  echo "❌ Backup integrity check failed!"
  exit 1
fi
```

#### Recovery Procedure (if needed)

```bash
#!/bin/bash
# server/scripts/restore-database.sh
# Usage: restore-database.sh <backup_date> (e.g., 20260305_020000)

BACKUP_DATE=$1
BACKUP_FILE="/backups/cpipl-hr/cpipl_hr_$BACKUP_DATE.db.gz"
DB_FILE="/app/server/prisma/dev.db"

# Step 1: Verify backup exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Step 2: Stop the application
echo "Stopping application..."
systemctl stop cpipl-hr-backend

# Step 3: Decompress backup
echo "Decompressing backup..."
gunzip -k $BACKUP_FILE

# Step 4: Verify backup integrity
sqlite3 "${BACKUP_FILE%.gz}" "PRAGMA integrity_check;"
if [ $? -ne 0 ]; then
  echo "❌ Backup file is corrupted!"
  systemctl start cpipl-hr-backend
  exit 1
fi

# Step 5: Restore
echo "Restoring database..."
cp "${BACKUP_FILE%.gz}" $DB_FILE

# Step 6: Start application
echo "Starting application..."
systemctl start cpipl-hr-backend

# Step 7: Verify application health
sleep 5
curl http://localhost:5000/api/health
if [ $? -eq 0 ]; then
  echo "✅ Database restored and application healthy"
else
  echo "⚠️ Restoration complete but health check failed"
  exit 1
fi
```

### Runbook 2: API Restart & Recovery

```bash
#!/bin/bash
# server/scripts/restart-api.sh

echo "🔄 Restarting API..."

# Step 1: Graceful shutdown (30s timeout)
systemctl stop cpipl-hr-backend --timeout=30

# Step 2: Clear cache
redis-cli FLUSHDB 2>/dev/null || true

# Step 3: Restart
systemctl start cpipl-hr-backend

# Step 4: Wait for startup
echo "Waiting for API startup..."
for i in {1..30}; do
  curl -s http://localhost:5000/api/health && break
  sleep 1
done

# Step 5: Verify
curl -s http://localhost:5000/api/health | jq .
echo "✅ API restart complete"
```

### Runbook 3: Performance Troubleshooting

```bash
#!/bin/bash
# server/scripts/diagnose-performance.sh

echo "🔍 Diagnosing performance issues..."

# 1. Check CPU usage
echo "\n📊 CPU Usage (top 5 processes):"
ps aux --sort=-%cpu | head -6

# 2. Check memory usage
echo "\n💾 Memory Usage:"
free -h
docker stats --no-stream 2>/dev/null || true

# 3. Check Node.js process
echo "\n⚙️ Node.js Process Info:"
pgrep -a node

# 4. Check database
echo "\n🗄️ Database Info:"
sqlite3 /app/server/prisma/dev.db ".stats"

# 5. Check slow API endpoints (from logs)
echo "\n🐢 Slow Endpoints (>1s):"
grep "Duration: " /var/log/cpipl-hr/api.log | awk -F'Duration: ' '{print $2}' | \
  awk '$1 > 1000 {count++} END {print "Found " count " slow requests"}'

# 6. Check error rate
echo "\n❌ Error Rate (last hour):"
grep "status: 5" /var/log/cpipl-hr/api.log | wc -l
echo " 5xx errors in last hour"

# 7. Database connection info
echo "\n🔗 Database Connections:"
lsof -p $(pgrep node) | grep "\.db" | wc -l

# Recommendations
echo "\n💡 Recommendations:"
echo "1. If CPU high: Check for slow queries or heavy computations"
echo "2. If memory high: Check for memory leaks (restart Node.js)"
echo "3. If disk slow: Check disk I/O, consider SSD upgrade"
echo "4. If API slow: Check database query times with EXPLAIN QUERY PLAN"
```

### Runbook 4: Database Optimization

```bash
#!/bin/bash
# server/scripts/optimize-database.sh

echo "🔧 Optimizing database..."

DB_FILE="/app/server/prisma/dev.db"

# 1. Analyze table usage
echo "Analyzing table statistics..."
sqlite3 $DB_FILE "ANALYZE;"

# 2. Rebuild indexes
echo "Rebuilding indexes..."
sqlite3 $DB_FILE "REINDEX;"

# 3. Reclaim space
echo "Reclaiming unused space..."
sqlite3 $DB_FILE "VACUUM;"

# 4. Check database integrity
echo "Checking database integrity..."
sqlite3 $DB_FILE "PRAGMA integrity_check;" | head -1

# 5. Display statistics
echo "\nDatabase Statistics:"
sqlite3 $DB_FILE <<EOF
.headers on
.mode column
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
SELECT COUNT(*) as TotalRecords FROM (
  SELECT COUNT(*) as records FROM "User"
  UNION ALL SELECT COUNT(*) FROM "AssetRepair"
  UNION ALL SELECT COUNT(*) FROM "Asset"
);
EOF

echo "✅ Optimization complete"
```

---

## Performance Baselines

### API Response Times (SLA Targets)

```
GET /api/assets                      < 100ms  (list)
GET /api/assets/:id                  < 50ms   (single)
GET /api/repairs                     < 150ms  (list with filtering)
GET /api/repairs/overdue             < 200ms  (complex query)
GET /api/vendors/performance         < 300ms  (aggregated metrics)

POST /api/repairs/:id/initiate       < 200ms  (create + audit trail)
PUT /api/repairs/:id/update-status   < 200ms  (update + timeline)
POST /api/repairs/:id/complete       < 300ms  (complex completion)

Database queries (p95):              < 100ms
Redis operations:                    < 10ms
```

### Resource Utilization Targets

```
CPU Usage (p95):                     < 60%
Memory Usage (p95):                  < 70% of available
Database File Size:                  < 500MB (normal operation)
Disk I/O Utilization:                < 40%

Connection Pool:
  - Database connections:            < 10 active
  - HTTP Keep-alive:                 < 100 concurrent
  - WebSocket connections:           < 50 concurrent
```

### Load Testing Results

```
Concurrent Users: 100
  - Request success rate: > 99%
  - p95 response time: < 300ms
  - Error rate: < 0.5%

Concurrent Users: 500 (stress test)
  - Request success rate: > 95%
  - p95 response time: < 1s
  - Error rate: < 2%

Sustained Load Test (24 hours, 50 users):
  - Average uptime: > 99.9%
  - Average response time: < 150ms
  - Zero memory leaks detected
```

### Database Performance Baselines

```
Average Query Time (by type):
  SELECT (simple):     < 5ms
  SELECT (join):       < 20ms
  SELECT (aggregate):  < 50ms
  INSERT:              < 10ms
  UPDATE:              < 15ms
  DELETE:              < 10ms

Index Performance:
  - Query with index:  < 10ms
  - Full table scan:   < 100ms
  - Query planner effectiveness: > 95%
```

---

## Incident Response Procedures

### Severity Levels & Response Time

```
CRITICAL (P1): > 30% error rate, complete service outage
  Response time: < 5 minutes
  Escalation: All-hands oncall

SEVERE (P2): 10-30% error rate, significant degradation
  Response time: < 15 minutes
  Escalation: Senior engineer + tech lead

HIGH (P3): 1-10% error rate, minor feature affected
  Response time: < 1 hour
  Escalation: Assigned engineer

MEDIUM (P4): < 1% error rate, user-reported issue
  Response time: < 4 hours
  Escalation: Next business day

LOW (P5): Non-critical bug, documentation issue
  Response time: < 1 business day
  Escalation: Backlog
```

### Incident Response Template

```markdown
## Incident Report: [ISSUE TITLE]

**Incident ID:** INC-2026-0305-001
**Severity:** P2 (SEVERE)
**Start Time:** 2026-03-05 10:30 UTC
**End Time:** 2026-03-05 10:47 UTC
**Duration:** 17 minutes

### Impact
- Services affected: Asset Repair API, Dashboard
- Users affected: ~50 employees
- Data loss: None
- Financial impact: ~$500 (estimated downtime)

### Root Cause
Database connection pool exhausted due to unoptimized query in /repairs list endpoint

### Timeline
10:30 - Alert triggered: High error rate (45% 5xx)
10:32 - On-call engineer notified
10:35 - Root cause identified: Slow query blocking connections
10:40 - Mitigation applied: Killed slow queries
10:47 - Service recovered, all systems green

### Resolution
1. Killed long-running query blocking connection pool
2. Restarted API with new connection pool size (20 → 50)
3. Applied database query optimization index

### Prevention
- Add slow-query alert (> 5s)
- Implement connection pool monitoring
- Add EXPLAIN QUERY PLAN to code review process

### Post-Incident
- Root cause analysis meeting: March 6, 2026
- Code review of query optimization
- Database monitoring enhancement
```

---

## Health Check & Diagnostics

### Automated Health Monitoring Script

```bash
#!/bin/bash
# server/scripts/health-check.sh
# Run every 5 minutes via cron

HEALTH_REPORT="/tmp/cpipl-health-$(date +%s).json"

# Collect metrics
cat > $HEALTH_REPORT << 'EOF'
{
  "timestamp": "$(date -Iseconds)",
  "backend": {
    "http_status": "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/health)",
    "response_time_ms": "$(curl -s -o /dev/null -w '%{time_total}000' http://localhost:5000/api/health)",
    "memory_usage_mb": "$(ps aux | grep 'node.*app.js' | grep -v grep | awk '{print $6}')",
    "cpu_usage_percent": "$(ps aux | grep 'node.*app.js' | grep -v grep | awk '{print $3}')"
  },
  "database": {
    "file_size_mb": "$(stat -f%z /app/server/prisma/dev.db 2>/dev/null | awk '{print $1/1024/1024}')",
    "integrity": "$(sqlite3 /app/server/prisma/dev.db 'PRAGMA integrity_check;' | head -1)",
    "connection_count": "$(lsof -p $(pgrep node) | grep '.db' | wc -l)"
  },
  "repairs": {
    "total_count": "$(sqlite3 /app/server/prisma/dev.db 'SELECT COUNT(*) FROM \"AssetRepair\";')",
    "overdue_count": "$(sqlite3 /app/server/prisma/dev.db 'SELECT COUNT(*) FROM \"AssetRepair\" WHERE status != \"completed\" AND expected_return_date < date(\"now\");')",
    "in_progress_count": "$(sqlite3 /app/server/prisma/dev.db 'SELECT COUNT(*) FROM \"AssetRepair\" WHERE status = \"in_progress\";')"
  }
}
EOF

# Upload to monitoring system
curl -X POST http://monitoring.local/api/health -d @$HEALTH_REPORT

# Cleanup
rm $HEALTH_REPORT
```

---

## Log Analysis & Troubleshooting

### Log File Locations

```
Application Logs:    /var/log/cpipl-hr/api.log
Frontend Logs:       /var/log/cpipl-hr/frontend.log
Database Logs:       /var/log/cpipl-hr/database.log
Nginx Access Logs:   /var/log/nginx/cpipl-hr-access.log
Nginx Error Logs:    /var/log/nginx/cpipl-hr-error.log
System Logs:         /var/log/syslog
```

### Common Issues & Solutions

#### Issue 1: High Error Rate (5xx)

```bash
# 1. Check recent errors
tail -100 /var/log/cpipl-hr/api.log | grep -i error

# 2. Identify error pattern
grep "500\|error\|exception" /var/log/cpipl-hr/api.log | tail -20

# 3. Check database connectivity
sqlite3 /app/server/prisma/dev.db "SELECT 1;"

# 4. Check memory usage
free -h
top -b -n 1 | head -20

# 5. Restart if needed
systemctl restart cpipl-hr-backend

# 6. Monitor recovery
tail -f /var/log/cpipl-hr/api.log
```

#### Issue 2: Slow API Responses

```bash
# 1. Enable slow-query logging
sqlite3 /app/server/prisma/dev.db "PRAGMA query_only = OFF;"

# 2. Identify slow endpoints
grep "Duration: " /var/log/cpipl-hr/api.log | \
  awk -F'[: ]' '{if ($2 > 1000) print $0}' | head -20

# 3. Analyze database query
# Look for N+1 queries, missing indexes
echo "SELECT sql FROM sqlite_master WHERE type='index' ORDER BY name;" | sqlite3 /app/server/prisma/dev.db

# 4. Run EXPLAIN QUERY PLAN
sqlite3 /app/server/prisma/dev.db "EXPLAIN QUERY PLAN SELECT * FROM AssetRepair WHERE status = 'in_progress';"

# 5. If missing index, create it
sqlite3 /app/server/prisma/dev.db "CREATE INDEX idx_repair_status ON AssetRepair(status);"
```

#### Issue 3: Database Locking

```bash
# 1. Check for long-running queries
lsof -p $(pgrep node) | grep ".db"

# 2. Kill blocking process if needed
kill -9 $(lsof -ti :5000)

# 3. Recover database
sqlite3 /app/server/prisma/dev.db "PRAGMA integrity_check;"

# 4. Restart
systemctl restart cpipl-hr-backend
```

---

## Disaster Recovery Procedures

### Backup & Restore Strategy

```
Daily backups:       2:00 AM UTC (automated)
Weekly backups:      Sunday 3:00 AM UTC (full system backup)
Monthly archives:    First Sunday of month (retained 1 year)
Point-in-time:       Continuous WAL (Write-Ahead Logs) for SQLite

Recovery Time Objective (RTO): 1 hour
Recovery Point Objective (RPO): 1 hour
```

### Complete System Recovery (Worst Case)

```bash
#!/bin/bash
# server/scripts/full-system-restore.sh

echo "🚨 FULL SYSTEM RESTORATION PROCEDURE"
echo "⚠️  This will restore the entire system from backup"
echo "Make sure you have the backup file available"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then exit 1; fi

# Step 1: Download latest backup from S3
echo "Downloading latest backup..."
aws s3 cp s3://cpipl-backups/latest/database.db.gz /tmp/

# Step 2: Extract backup
echo "Extracting backup..."
gunzip /tmp/database.db.gz

# Step 3: Verify backup
echo "Verifying backup integrity..."
sqlite3 /tmp/database.db "PRAGMA integrity_check;"

# Step 4: Stop application stack
echo "Stopping application..."
docker-compose down

# Step 5: Restore database
echo "Restoring database..."
cp /tmp/database.db ./server/prisma/dev.db

# Step 6: Restart application
echo "Restarting application..."
docker-compose up -d

# Step 7: Verify restoration
echo "Verifying restoration..."
sleep 10
curl http://localhost:5000/api/health

echo "✅ System restoration complete"
```

---

## Capacity Planning

### Growth Projections

```
Current (March 2026):
  - Repairs/month: 100
  - Database size: 50MB
  - Peak concurrent users: 50
  - API requests/sec: 10

Projected (December 2026):
  - Repairs/month: 300 (+200%)
  - Database size: 150MB
  - Peak concurrent users: 150 (+200%)
  - API requests/sec: 30 (+200%)

Projected (December 2027):
  - Repairs/month: 600 (+100%)
  - Database size: 300MB
  - Peak concurrent users: 300
  - API requests/sec: 60
```

### Infrastructure Upgrade Timeline

```
Q2 2026:
  - Increase database connection pool (10 → 20)
  - Add Redis caching layer
  - Implement CDN for static assets

Q3 2026:
  - Migrate SQLite → PostgreSQL (if repairs > 500/month)
  - Add load balancer if peak users > 200
  - Implement horizontal scaling (3 API instances)

Q4 2026:
  - Add read replicas for analytics
  - Implement database sharding (by company)
  - Add data warehouse for reporting
```

---

## Runbook Index

### Quick Reference

| Situation | Runbook | Time |
|-----------|---------|------|
| Database backup failed | Runbook 1 | 10 min |
| API unresponsive | Runbook 2 | 5 min |
| Slow API responses | Runbook 3 | 15 min |
| Database running slow | Runbook 4 | 20 min |
| High error rate | Incident Response | 30 min |
| Out of disk space | Capacity Planning | 1 hour |

---

## Support Contact Information

```
On-Call Rotation:
  Monday-Friday: devops@cpipl.com
  Weekends: senior-eng@cpipl.com
  Critical: PagerDuty (auto-escalation)

Emergency Escalation:
  Tech Lead: +91 98765-43210
  VP Engineering: +91 98765-43211
  CTO: +91 98765-43212 (P1 only)
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-05 | Initial production operations manual |

---

**Status:** ✅ READY FOR PRODUCTION  
**Last Updated:** March 5, 2026  
**Next Review:** June 5, 2026

