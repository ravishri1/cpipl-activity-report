@echo off
echo ============================================================
echo Asset Repair System - Automated Test Suite
echo ============================================================
echo.
echo Running tests...
echo.

REM Change to server directory
cd /d "D:\Activity Report Software\server"

REM Run the test file directly with node
node tests\repair-endpoints.test.js

echo.
echo ============================================================
echo Test execution completed
echo ============================================================
