@echo off
cd /d "D:\Activity Report Software\server"
npx prisma migrate dev --name add_predictive_maintenance
pause
