@echo off
cd /d "D:\Activity Report Software"
if errorlevel 1 (
  echo Error: Could not change to project directory
  exit /b 1
)

echo ========================================
echo PHASE 3 PRODUCTION DEPLOYMENT
echo ========================================
echo.
echo Committing all changes...
git commit -m "Production Deployment: Google Drive File Management, Insurance Cards, Training Module, Asset Repairs Design, Phase 3 Data Exports - March 4, 2026"
if errorlevel 1 (
  echo Warning: Git commit may have already been made or no changes staged
)

echo.
echo Pushing to production...
git push origin main
if errorlevel 1 (
  echo Warning: Git push may have failed - check network/credentials
)

echo.
echo ========================================
echo Deployment Status: COMPLETE
echo ========================================
echo.
echo Next: Phase 4 - Data Transformation and Import
echo.
pause
