@echo off
REM Execute Prisma migration for Procurement system
REM This script navigates to the server directory and runs the migration

cd /d D:\Activity Report Software\server
echo Current directory: %cd%
echo.
echo ====================================
echo Executing Prisma Migration
echo ====================================
echo.

REM Run the migration
npx prisma migrate dev --name add_procurement_integration

echo.
echo ====================================
echo Migration Complete
echo ====================================
pause
