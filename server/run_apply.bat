@echo off
cd /d "D:\Activity Report Software\server"
node applyOpeningBalances.js > apply_result.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL%
