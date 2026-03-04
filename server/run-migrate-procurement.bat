@echo off
REM Migration Script: Add Procurement Integration
REM Runs: npx prisma migrate dev --name add_procurement_integration

cd /d "D:\Activity Report Software\server"
echo.
echo 🚀 Starting Procurement Integration Migration...
echo.

npx prisma migrate dev --name add_procurement_integration

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Migration completed successfully!
    echo.
    echo 📊 Schema Changes Applied:
    echo   • User model: Added 5 procurement relations
    echo   • Asset model: Added 4 procurement fields + 1 relation
    echo   • Database: Ready for API endpoints
    echo.
) else (
    echo.
    echo ❌ Migration failed with error code %ERRORLEVEL%
    echo.
)

pause
