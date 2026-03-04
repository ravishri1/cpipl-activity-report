@echo off
REM Run tests and save output to file
cd /d "D:\Activity Report Software\server"
node tests\repair-endpoints.test.js > test-results.txt 2>&1
echo Test execution completed. Results saved to test-results.txt
pause