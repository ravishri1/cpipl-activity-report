@echo off
cd /d "D:\Activity Report Software\server"
"C:\Program Files\nodejs\node.exe" node_modules\prisma\build\index.js db push > push-result.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> push-result.txt
