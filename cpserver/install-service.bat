@echo off
echo ═══════════════════════════════════════════════
echo   Installing Biometric Service as Windows Service
echo ═══════════════════════════════════════════════

REM Install node-windows globally
call npm install -g node-windows

REM Create service installer script
echo const Service = require('node-windows').Service; > "%~dp0install-svc.js"
echo const svc = new Service({ >> "%~dp0install-svc.js"
echo   name: 'BiometricService', >> "%~dp0install-svc.js"
echo   description: 'Biometric API + Cloudflare Tunnel for CPIPL HR System', >> "%~dp0install-svc.js"
echo   script: 'C:\\esslSync\\biometricService.js', >> "%~dp0install-svc.js"
echo   nodeOptions: [], >> "%~dp0install-svc.js"
echo   workingDirectory: 'C:\\esslSync', >> "%~dp0install-svc.js"
echo }); >> "%~dp0install-svc.js"
echo svc.on('install', function() { >> "%~dp0install-svc.js"
echo   console.log('Service installed! Starting...'); >> "%~dp0install-svc.js"
echo   svc.start(); >> "%~dp0install-svc.js"
echo }); >> "%~dp0install-svc.js"
echo svc.on('alreadyinstalled', function() { >> "%~dp0install-svc.js"
echo   console.log('Service already installed.'); >> "%~dp0install-svc.js"
echo }); >> "%~dp0install-svc.js"
echo svc.install(); >> "%~dp0install-svc.js"

REM Run installer
node "%~dp0install-svc.js"

echo.
echo Done! BiometricService is now a Windows Service.
echo It will auto-start on boot.
pause
