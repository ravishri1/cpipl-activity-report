@echo off
echo ============================================
echo   Testing eSSL SQL Sync
echo ============================================
echo.
cd /d C:\esslSync
echo Current directory: %CD%
echo.
echo Running SQL sync...
echo.
"C:\Program Files\nodejs\node.exe" esslSqlSync.js
echo.
echo ============================================
echo   Exit code: %errorlevel%
echo ============================================
echo.
pause
