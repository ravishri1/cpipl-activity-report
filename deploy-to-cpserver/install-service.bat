@echo off
echo ============================================
echo   Install eSSL Sync Agent as Windows Service
echo   (Auto-starts on PC boot)
echo ============================================
echo.

:: Check for admin rights
net session >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Run this as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"

:: Install pm2 globally if not present
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing pm2 (process manager)...
    call npm install -g pm2 pm2-windows-startup
    echo.
)

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
    echo .env created!
    echo.
)

:: Start the agent with pm2
echo Starting agent with pm2...
call pm2 start esslSyncAgent.js --name "essl-sync-agent" --cwd "%~dp0"
call pm2 save

:: Set up auto-start on Windows boot
echo Setting up auto-start...
call pm2-startup install

echo.
echo ============================================
echo   Done! Agent is now running and will
echo   auto-start when this PC boots up.
echo.
echo   Useful commands:
echo     pm2 status          - Check agent status
echo     pm2 logs essl-sync  - View agent logs
echo     pm2 restart essl-sync - Restart agent
echo     pm2 stop essl-sync  - Stop agent
echo ============================================
pause
