@echo off
echo Starting CPIPL Backend Development Server...
echo.
cd /d D:\Activity Report Software\server
echo Current Directory: %cd%
echo.
echo Running: npm run dev
echo This will trigger Prisma migration automatically...
echo.
npm run dev
