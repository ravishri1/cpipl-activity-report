@echo off
cd /d "D:\Activity Report Software\server"
echo Running database migration...
call npm run db:migrate
pause
