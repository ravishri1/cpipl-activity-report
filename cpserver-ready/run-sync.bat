@echo off
cd /d C:\esslSync
"C:\Program Files\nodejs\node.exe" esslSqlSync.js >> sync-log.txt 2>&1
