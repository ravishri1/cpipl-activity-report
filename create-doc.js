const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber, PageBreak } = require("docx");

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cm = { top: 60, bottom: 60, left: 100, right: 100 };

function hc(text, w) {
  return new TableCell({ borders, width: { size: w, type: WidthType.DXA }, shading: { fill: "2E4057", type: ShadingType.CLEAR }, margins: cm,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })] });
}
function tc(text, w) {
  return new TableCell({ borders, width: { size: w, type: WidthType.DXA }, margins: cm,
    children: [new Paragraph({ children: [new TextRun({ text: text || "", font: "Arial", size: 20 })] })] });
}
function mt(headers, rows, widths) {
  const tw = widths.reduce((a, b) => a + b, 0);
  return new Table({ width: { size: tw, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ children: headers.map((h, i) => hc(h, widths[i])) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => tc(c, widths[i])) }))] });
}
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 }, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 32, color: "2E4057" })] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 250, after: 150 }, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 26, color: "2E4057" })] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t, bold: true, font: "Arial", size: 22, color: "445566" })] }); }
function p(t) { return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, font: "Arial", size: 20 })] }); }
function cd(t) { return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: t, font: "Consolas", size: 18, color: "333333" })] }); }
function bl(t) { return new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022 " + t, font: "Arial", size: 20 })] }); }
function sp() { return new Paragraph({ spacing: { after: 100 }, children: [] }); }
function hr() { return new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } }, children: [] }); }

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "CPIPL HR - Biometric Integration Guide", font: "Arial", size: 16, color: "999999", italics: true })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", font: "Arial", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })] })] }) },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Biometric Integration", font: "Arial", size: 48, bold: true, color: "2E4057" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: "CPIPL HR System", font: "Arial", size: 32, color: "666666" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Complete Technical Reference", font: "Arial", size: 22, color: "999999", italics: true })] }),
      hr(),
      h1("Architecture Overview"),
      cd("eSSL Biometric Machines (3 devices)"),
      cd("        \u2193 (punches stored in SQL Server)"),
      cd("cpserver (192.168.2.222) - SQL Server + Biometric API + Cloudflare Tunnel"),
      cd("        \u2193 (tunnel exposes API to internet)"),
      cd("Cloudflare Tunnel (free, auto-generated URL)"),
      cd("        \u2193"),
      cd("eod.colorpapers.in (Vercel) - HR Portal reads punch data via tunnel"),
      sp(),
      h2("Components"),
      mt(["Component", "Location", "Purpose"],
        [["eSSL Biometric Machines", "Mumbai (2), Lucknow (1)", "Capture employee fingerprint punches"],
         ["eTimeTracklite SQL Server", "cpserver (192.168.2.222)", "Stores ALL punch data forever"],
         ["Biometric Service (Node.js)", "cpserver C:\\esslSync\\", "Express API + Cloudflare Tunnel"],
         ["esslSqlSync.js", "cpserver C:\\esslSync\\", "Pushes today punches to Neon"],
         ["HR Portal", "eod.colorpapers.in", "Displays punch data, attendance"]], [3000, 3000, 3840]),
      hr(),
      h1("Biometric Devices"),
      mt(["Device Name", "Serial Number", "Location", "IP Address"],
        [["CP IN (Mumbai)", "CEXJ230260263", "Mumbai HO", "192.168.2.201"],
         ["CP OUT (Mumbai)", "CEXJ230260034", "Mumbai HO", "192.168.2.205"],
         ["Lucknow eSSL", "EUF7241301750", "Lucknow", "192.168.0.203"]], [2500, 2800, 2000, 2540]),
      hr(),
      h1("cpserver Details"),
      mt(["Setting", "Value"],
        [["Server Name", "CPSERVER"], ["IP Address", "192.168.2.222"], ["OS", "Windows Server"], ["Node.js", "v24.14.0"], ["Remote Desktop", "RDP to 192.168.2.222"], ["Login", "Administrator"]], [3000, 6840]),
      hr(),
      h1("SQL Server Database (eSSL eTimeTracklite)"),
      mt(["Setting", "Value"],
        [["Server", "CPSERVER"], ["Database", "etimetracklite1"], ["Username", "essl"], ["Password", "essl"], ["Port", "1433"], ["Tables", "DeviceLogs_{month}_{year}"]], [3000, 6840]),
      sp(),
      h3("Device ID Mapping"),
      mt(["DeviceId (SQL)", "Device Serial", "Device Name"],
        [["19", "CEXJ230260263", "CP IN (Mumbai)"], ["20", "CEXJ230260034", "CP OUT (Mumbai)"], ["21", "EUF7241301750", "Lucknow eSSL"]], [2500, 3500, 3840]),
      hr(),
      h1("Files on cpserver (C:\\esslSync\\)"),
      mt(["File", "Purpose"],
        [["biometricService.js", "Main service - API + Tunnel + auto-register"],
         ["esslSqlSync.js", "Sync agent - pushes today punches to Neon every 5 min"],
         ["cloudflared.exe", "Cloudflare Tunnel binary"],
         [".env", "Environment variables"],
         ["biometric-service.log", "Service log file"],
         ["sync-log.txt", "Sync agent log file"]], [3000, 6840]),
      hr(),
      h1("Windows Services & Scheduled Tasks"),
      h2("BiometricService (Windows Service)"),
      mt(["Setting", "Value"],
        [["Service Name", "biometricservice.exe"],
         ["Script", "C:\\esslSync\\biometricService.js"],
         ["What it does", "Runs API on port 3001, starts Tunnel, auto-registers URL"],
         ["Auto-start", "Yes (Windows Service, starts on boot)"],
         ["Check status", "sc query \"biometricservice.exe\""],
         ["Restart", "sc stop then sc start \"biometricservice.exe\""],
         ["Logs", "C:\\esslSync\\biometric-service.log"]], [3000, 6840]),
      sp(),
      h2("esslSync (Scheduled Task)"),
      mt(["Setting", "Value"],
        [["Task Name", "esslSync"], ["Script", "C:\\esslSync\\esslSqlSync.js"], ["Schedule", "Every 5 minutes"], ["Run As", "SYSTEM"]], [3000, 6840]),
      hr(),
      h1("Cloudflare Tunnel"),
      mt(["Setting", "Value"],
        [["Type", "Quick Tunnel (free, no account needed)"], ["Cost", "Free, unlimited, forever"], ["URL Format", "https://random-words.trycloudflare.com"], ["URL Changes", "Yes, changes on every restart"], ["Auto-registration", "Service auto-registers new URL with HR app"]], [3000, 6840]),
      sp(),
      h3("How it works"),
      p("1. biometricService.js starts Express API on port 3001"),
      p("2. It spawns cloudflared.exe tunnel --url http://localhost:3001"),
      p("3. Cloudflare assigns a random public URL"),
      p("4. biometricService.js captures the URL from cloudflared output"),
      p("5. POSTs the URL to https://eod.colorpapers.in/api/biometric/register-tunnel"),
      p("6. HR app stores the URL in Settings table (key: biometric_tunnel_url)"),
      p("7. HR app reads the URL and calls the tunnel when it needs punch data"),
      hr(),
      h1("API Authentication"),
      mt(["Setting", "Value"],
        [["Agent Key Header", "x-agent-key"], ["Agent Key Value", "cpipl-bio-sync-2026-xK9mP4qR7v2"], ["Or via query param", "?key=cpipl-bio-sync-2026-xK9mP4qR7v2"]], [3000, 6840]),
      hr(),
      h1("API Endpoints - HR App"),
      mt(["Method", "Path", "Purpose"],
        [["POST", "/api/biometric/register-tunnel", "cpserver registers tunnel URL"],
         ["GET", "/api/biometric/tunnel-status", "Check tunnel connection"],
         ["GET", "/api/biometric/punches?source=tunnel", "Punch log from tunnel"],
         ["POST", "/api/biometric/purge-neon", "Delete old punches from Neon"]], [1500, 4500, 3840]),
      sp(),
      h1("API Endpoints - cpserver (via tunnel)"),
      mt(["Method", "Path", "Purpose"],
        [["GET", "/health", "Health check"],
         ["GET", "/api/punches?date=2026-03-23", "Punches for a date"],
         ["GET", "/api/punches/range?start=...&end=...", "Punches for date range"],
         ["GET", "/api/stats", "Records per month"]], [1500, 4500, 3840]),
      hr(),
      h1("Data Flow"),
      h3("Real-time attendance (today)"),
      cd("eSSL Machine -> SQL Server -> esslSqlSync.js (5 min) -> Neon -> Attendance matching"),
      sp(),
      h3("Historical punch viewing (any date)"),
      cd("HR Portal -> Vercel -> reads tunnel URL -> calls cpserver -> SQL Server -> returns data"),
      sp(),
      h3("Auto-cleanup"),
      bl("Daily 2 AM IST: BiometricPunch older than 7 days deleted from Neon"),
      bl("Data safe forever in cpserver SQL Server"),
      bl("Historical data always accessible via tunnel"),
      hr(),
      new Paragraph({ children: [new PageBreak()] }),
      h1("Troubleshooting"),
      h3("Punches not syncing"),
      p("1. RDP to cpserver (192.168.2.222)"),
      p("2. Check: schtasks /query /tn \"esslSync\" /v /fo list"),
      p("3. Test: cd C:\\esslSync && node esslSqlSync.js"),
      sp(),
      h3("Tunnel not working"),
      p("1. Check: sc query \"biometricservice.exe\""),
      p("2. If not RUNNING: sc start \"biometricservice.exe\""),
      p("3. Check log: type C:\\esslSync\\biometric-service.log"),
      p("4. Test: http://localhost:3001/health"),
      sp(),
      h3("Unknown employees in Punch Log"),
      bl("Go to Biometric > Employee Mappings tab"),
      bl("Assign each employee biometric enroll number"),
      sp(),
      h3("Task Scheduler stops after 3 days"),
      p("1. Open taskschd.msc"),
      p("2. Find task > Properties > Settings"),
      p("3. UNCHECK \"Stop the task if it runs longer than\""),
      hr(),
      h1("Setup From Scratch"),
      p("1. Install Node.js from nodejs.org"),
      p("2. mkdir C:\\esslSync && cd C:\\esslSync && npm init -y && npm install mssql express node-windows"),
      p("3. Download biometricService.js from GitHub repo cpserver/ folder"),
      p("4. Download cloudflared.exe from GitHub cloudflare/cloudflared releases"),
      p("5. Test: node biometricService.js"),
      p("6. Install service with node-windows"),
      p("7. Create sync task: schtasks /create /tn esslSync ..."),
      p("8. Uncheck 72-hour limit in Task Scheduler"),
      hr(),
      sp(),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Document created: March 23, 2026", font: "Arial", size: 18, color: "999999", italics: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "System designed by: Claude AI + Ravi Shrivastav", font: "Arial", size: 18, color: "999999", italics: true })] }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Users\\91992\\Desktop\\Biometric-Integration-Guide.docx", buffer);
  console.log("Word document created on Desktop!");
});
