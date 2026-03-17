@echo off
title eSSL Biometric Sync Agent
echo ============================================
echo   eSSL Biometric Sync Agent
echo   Syncs all devices from cpserver to cloud
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

:: Navigate to script directory
cd /d "%~dp0"

:: Create .env if it doesn't exist
if not exist ".env" (
    echo Creating default .env file...
    (
        echo MODE=multi
        echo HR_API_URL=https://eod.colorpapers.in
        echo HR_AGENT_KEY=biometric-sync-key
        echo POLL_INTERVAL_MINUTES=5
        echo LOOKBACK_DAYS=1
    ) > .env
    echo .env created! Edit it if you need to change settings.
    echo.
)

echo Starting sync agent...
echo Press Ctrl+C to stop.
echo.

:loop
node esslSyncAgent.js
echo.
echo Agent stopped unexpectedly. Restarting in 10 seconds...
timeout /t 10 /nobreak >nul
goto loop
