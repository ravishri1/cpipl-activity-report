@echo off
echo ============================================
echo   eSSL Biometric Sync - Auto Setup
echo ============================================
echo.

:: Delete old task if exists
schtasks /delete /tn "eSSL Biometric Sync" /f >nul 2>&1

:: Create scheduled task - runs every 5 minutes as SYSTEM (survives restarts, no login needed)
schtasks /create /tn "eSSL Biometric Sync" /tr "C:\esslSync\run-sync.bat" /sc minute /mo 5 /ru SYSTEM /rl HIGHEST /f

if %errorlevel%==0 (
    echo.
    echo SUCCESS! Task created.
    echo.
    echo The sync will run every 5 minutes automatically.
    echo It survives PC restarts - no CMD window needed.
    echo Each run is independent - if one fails, next one works fine.
    echo.
    echo To check logs:   type C:\esslSync\sync-log.txt
    echo To stop:         schtasks /delete /tn "eSSL Biometric Sync" /f
    echo To check status: schtasks /query /tn "eSSL Biometric Sync"
    echo To run now:      schtasks /run /tn "eSSL Biometric Sync"
) else (
    echo.
    echo FAILED - Please run this file as Administrator
    echo Right-click install-scheduler.bat and select "Run as administrator"
)

echo.
pause
