# Biometric Integration — CPIPL HR System

## Architecture Overview

```
eSSL Biometric Machines (3 devices)
        ↓ (punches stored in SQL Server)
cpserver (192.168.2.222) — SQL Server + Biometric API + Cloudflare Tunnel
        ↓ (tunnel exposes API to internet)
Cloudflare Tunnel (free, auto-generated URL)
        ↓
eod.colorpapers.in (Vercel) — HR Portal reads punch data via tunnel
```

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| eSSL Biometric Machines | Mumbai (2), Lucknow (1) | Capture employee fingerprint punches |
| eTimeTracklite SQL Server | cpserver (192.168.2.222) | Stores ALL punch data forever |
| Biometric Service (Node.js) | cpserver `C:\esslSync\` | Express API + Cloudflare Tunnel |
| esslSqlSync.js | cpserver `C:\esslSync\` | Pushes today's punches to Neon for attendance matching |
| HR Portal | eod.colorpapers.in (Vercel) | Displays punch data, attendance |

---

## Biometric Devices

| Device Name | Serial Number | Location | IP Address |
|-------------|--------------|----------|------------|
| CP IN (Mumbai) | CEXJ230260263 | Mumbai HO | 192.168.2.201 |
| CP OUT (Mumbai) | CEXJ230260034 | Mumbai HO | 192.168.2.205 |
| Lucknow eSSL | EUF7241301750 | Lucknow | 192.168.0.203 |

---

## cpserver Details

| Setting | Value |
|---------|-------|
| Server Name | CPSERVER |
| IP Address | 192.168.2.222 |
| OS | Windows Server |
| Node.js | v24.14.0 |
| Remote Desktop | Use RDP to 192.168.2.222 |
| Login | Administrator |

---

## SQL Server Database (eSSL eTimeTracklite)

| Setting | Value |
|---------|-------|
| Server | CPSERVER |
| Database | etimetracklite1 |
| Username | essl |
| Password | essl |
| Port | 1433 |
| Tables | `DeviceLogs_{month}_{year}` (e.g., `DeviceLogs_3_2026`) |

### Device ID Mapping (SQL → Device Serial)

| DeviceId (SQL) | Device Serial | Device Name |
|----------------|--------------|-------------|
| 19 | CEXJ230260263 | CP IN (Mumbai) |
| 20 | CEXJ230260034 | CP OUT (Mumbai) |
| 21 | EUF7241301750 | Lucknow eSSL |

### SQL Query to get punches

```sql
SELECT
    DeviceId,
    CAST(UserId AS VARCHAR) AS enrollNumber,
    LogDate AS punchTime,
    Direction
FROM dbo.DeviceLogs_3_2026
WHERE LogDate >= '2026-03-23'
ORDER BY LogDate ASC
```

---

## Files on cpserver (`C:\esslSync\`)

| File | Purpose |
|------|---------|
| `biometricService.js` | Main service — Express API (port 3001) + Cloudflare Tunnel + auto-registers tunnel URL with HR app |
| `esslSqlSync.js` | Sync agent — pushes today's punches to Neon every 5 min (for attendance matching) |
| `cloudflared.exe` | Cloudflare Tunnel binary — creates public URL for the API |
| `.env` | Environment variables (HR_API_URL, HR_AGENT_KEY) |
| `biometric-service.log` | Service log file |
| `sync-log.txt` | Sync agent log file |
| `check-devices.js` | Utility to check device IDs in SQL |
| `check-device-names.js` | Utility to check device names |
| `sync-full-year.js` | One-time script to sync historical data |

---

## Windows Services & Scheduled Tasks

### BiometricService (Windows Service)

| Setting | Value |
|---------|-------|
| Service Name | biometricservice.exe |
| Script | `C:\esslSync\biometricService.js` |
| What it does | Runs Express API on port 3001, starts Cloudflare Tunnel, auto-registers tunnel URL |
| Auto-start | Yes (Windows Service, starts on boot) |
| Check status | `sc query "biometricservice.exe"` |
| Restart | `sc stop "biometricservice.exe"` then `sc start "biometricservice.exe"` |
| Logs | `C:\esslSync\biometric-service.log` |

### esslSync (Scheduled Task)

| Setting | Value |
|---------|-------|
| Task Name | esslSync |
| Script | `C:\esslSync\esslSqlSync.js` |
| Schedule | Every 5 minutes |
| What it does | Pushes today's punches from SQL Server to Neon (for attendance matching) |
| Run As | SYSTEM |
| Check status | `schtasks /query /tn "esslSync" /v /fo list` |
| Logs | `C:\esslSync\sync-log.txt` |

---

## Cloudflare Tunnel

| Setting | Value |
|---------|-------|
| Type | Quick Tunnel (free, no account needed) |
| Binary | `C:\esslSync\cloudflared.exe` |
| Cost | Free, unlimited, forever |
| URL Format | `https://random-words.trycloudflare.com` |
| URL Changes | Yes, changes on every restart |
| Auto-registration | biometricService.js automatically registers new URL with HR app |

### How it works

1. biometricService.js starts Express API on port 3001
2. It spawns `cloudflared.exe tunnel --url http://localhost:3001`
3. Cloudflare assigns a random public URL
4. biometricService.js captures the URL from cloudflared output
5. POSTs the URL to `https://eod.colorpapers.in/api/biometric/register-tunnel`
6. HR app stores the URL in Settings table (key: `biometric_tunnel_url`)
7. When HR app needs punch data, it reads the URL from Settings and calls the tunnel

---

## HR App Integration

### API Endpoints on HR App (eod.colorpapers.in)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/biometric/register-tunnel` | Agent Key | cpserver registers its tunnel URL |
| GET | `/api/biometric/tunnel-status` | Admin | Check if tunnel is connected |
| GET | `/api/biometric/tunnel-punches` | Admin | Proxy punch queries to cpserver |
| GET | `/api/biometric/punches?source=tunnel` | Admin | Punch log with tunnel data source |
| POST | `/api/biometric/purge-neon` | Admin | Delete old punches from Neon |

### API Endpoints on cpserver (via tunnel)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | None | Health check |
| GET | `/api/punches?date=2026-03-23` | Agent Key | Get punches for a date |
| GET | `/api/punches/range?start=2026-03-01&end=2026-03-23` | Agent Key | Get punches for date range |
| GET | `/api/stats` | Agent Key | Total records per month |

### Authentication

| Setting | Value |
|---------|-------|
| Agent Key Header | `x-agent-key` |
| Agent Key Value | `cpipl-bio-sync-2026-xK9mP4qR7v2` |
| Or via query param | `?key=cpipl-bio-sync-2026-xK9mP4qR7v2` |

---

## Data Flow

### Real-time attendance (today)

```
eSSL Machine → SQL Server → esslSqlSync.js (every 5 min) → Neon DB → Attendance matching
```

### Historical punch viewing (any date)

```
HR Portal → Vercel API → reads tunnel URL from Settings → calls cpserver tunnel → SQL Server → returns data
```

### Auto-cleanup

- Daily at 2 AM IST: BiometricPunch records older than 7 days deleted from Neon
- Data is safe forever in cpserver SQL Server
- Historical data always accessible via tunnel

---

## Neon Database (Production)

| Setting | Value |
|---------|-------|
| Project | summer-river |
| Host | ep-shiny-meadow-ai9ssvlk-pooler.c-4.us-east-1.aws.neon.tech |
| Database | neondb |
| Related Tables | BiometricPunch, BiometricDevice, Attendance |

### BiometricPunch table (Neon)

- Only keeps last 7 days of data (for attendance matching)
- Old data auto-purged by daily cron
- All historical data in cpserver SQL Server

---

## Troubleshooting

### Biometric data not syncing (no new punches)

1. RDP to cpserver (192.168.2.222)
2. Check sync task: `schtasks /query /tn "esslSync" /v /fo list`
3. Check last sync: `type C:\esslSync\sync-log.txt` (look at last entries)
4. Manual test: `cd C:\esslSync && node esslSqlSync.js`

### Tunnel not working (portal shows "Tunnel unreachable")

1. RDP to cpserver (192.168.2.222)
2. Check service: `sc query "biometricservice.exe"`
3. If not RUNNING: `sc start "biometricservice.exe"`
4. Check log: `type C:\esslSync\biometric-service.log`
5. Test locally: open browser → `http://localhost:3001/health`
6. If port 3001 busy, restart: `sc stop "biometricservice.exe"` wait 10s → `sc start "biometricservice.exe"`

### Punch Log shows "Unknown" for all employees

- Go to Biometric → Employee Mappings tab
- Assign each employee's biometric enroll number (bioDeviceId)
- After mapping, tunnel data will show employee names

### All-time Punches count growing in Neon

- The 2 AM cron should be cleaning up
- Manual purge: Open browser console on eod.colorpapers.in and run:
  ```js
  fetch('/api/biometric/purge-neon', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await window.Clerk?.session?.getToken()) }, body: JSON.stringify({ keepDays: 0 }) }).then(r => r.json()).then(d => alert(JSON.stringify(d)))
  ```

### Task Scheduler stops after 3 days

1. Open Task Scheduler: `taskschd.msc`
2. Find the task → Properties → Settings tab
3. **UNCHECK** "Stop the task if it runs longer than"
4. Click OK

---

## Ngrok Account (created but not used)

| Setting | Value |
|---------|-------|
| Account | Color Papers |
| Dashboard | dashboard.ngrok.com |
| Note | Created during setup but Cloudflare Tunnel was used instead (free, no card) |

## Cloudflare Account (created but not used for tunnel)

| Setting | Value |
|---------|-------|
| Email | Jyoti.naik@colorpapers.in |
| Dashboard | dash.cloudflare.com |
| Note | Zero Trust requires payment method. Using free quick tunnel instead (no account needed). |

---

## Setup From Scratch (if cpserver is replaced)

### Step 1: Install Node.js
Download and install Node.js from nodejs.org

### Step 2: Create project folder
```cmd
mkdir C:\esslSync
cd C:\esslSync
npm init -y
npm install mssql express node-windows
```

### Step 3: Download files from GitHub
```
https://github.com/ravishri1/cpipl-activity-report/tree/main/cpserver
```
Copy `biometricService.js` to `C:\esslSync\`
Copy `esslSqlSync.js` to `C:\esslSync\`

### Step 4: Download cloudflared
```
https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
```
Save as `C:\esslSync\cloudflared.exe`

### Step 5: Test
```cmd
cd C:\esslSync && node biometricService.js
```
Should show: API running on port 3001, Tunnel URL, Registered with HR app

### Step 6: Install as Windows Service
```cmd
cd C:\esslSync
node -e "const svc = new (require('node-windows').Service)({name:'BiometricService',description:'Biometric API + Tunnel',script:'C:\\esslSync\\biometricService.js',workingDirectory:'C:\\esslSync'});svc.on('install',()=>{console.log('Installed!');svc.start()});svc.install()"
```

### Step 7: Create sync scheduled task
```cmd
schtasks /create /tn "esslSync" /tr "\"C:\Program Files\nodejs\node.exe\" C:\esslSync\esslSqlSync.js" /sc minute /mo 5 /ru SYSTEM /rl HIGHEST /f
```

### Step 8: Remove 72-hour limit
Open `taskschd.msc` → esslSync → Properties → Settings → UNCHECK "Stop the task if it runs longer than"

---

*Document created: March 23, 2026*
*System designed and implemented by: Claude AI + Ravi Shrivastav*
