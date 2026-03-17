@echo off
echo ============================================
echo   eSSL Biometric Sync - Auto Setup
echo ============================================
echo.

:: Delete old task if exists
schtasks /delete /tn "eSSL Biometric Sync" /f >nul 2>&1

:: Create scheduled task using the wrapper batch file
schtasks /create /tn "eSSL Biometric Sync" /tr "C:\esslSync\run-sync.bat" /sc minute /mo 5 /ru SYSTEM /rl HIGHEST /f

if %errorlevel%==0 (
    echo.
    echo SUCCESS! Task created.
    echo.
    echo The sync will now run automatically every 5 minutes.
    echo It will continue even after restart - no CMD window needed.
    echo.
    echo To check logs: open C:\esslSync\sync-log.txt
    echo To stop:  schtasks /delete /tn "eSSL Biometric Sync" /f
    echo To check: schtasks /query /tn "eSSL Biometric Sync"
) else (
    echo.
    echo FAILED - Please run this file as Administrator
    echo Right-click install-scheduler.bat and select "Run as administrator"
)

echo.
pause
