@echo off
title eSSL Biometric Sync Agent
echo ========================================
echo   eSSL Biometric Sync Agent
echo   Syncs all devices to cloud
echo ========================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

echo Starting sync agent...
echo Press Ctrl+C to stop.
echo.

:loop
node esslSyncAgent.js
echo.
echo Agent stopped. Restarting in 10 seconds...
timeout /t 10 /nobreak >nul
goto loop
