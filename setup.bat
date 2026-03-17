@echo off
title CPIPL Activity Report - Full Setup
color 0B

echo ============================================================
echo   CPIPL Activity Report - New System Setup
echo   This will install everything needed to run the project
echo ============================================================
echo.

:: Check Node.js
echo [1/8] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Node.js is NOT installed!
    echo   Download from: https://nodejs.org
    echo   Install Node.js 18+ LTS and run this script again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   Found Node.js %NODE_VER%

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: npm is NOT installed!
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo   Found npm v%NPM_VER%

:: Check Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo   WARNING: Git is NOT installed. You won't be able to push/deploy.
    echo   Download from: https://git-scm.com
) else (
    for /f "tokens=*" %%v in ('git --version') do set GIT_VER=%%v
    echo   Found %GIT_VER%
)
echo   OK
echo.

:: Install server dependencies
echo [2/8] Installing backend dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo   ERROR: Backend install failed!
    cd ..
    pause
    exit /b 1
)
echo   OK
cd ..
echo.

:: Check .env file
echo [3/8] Checking environment configuration...
if not exist "server\.env" (
    echo   WARNING: server\.env file NOT found!
    echo.
    echo   REQUIRED: Copy server\.env.example to server\.env
    echo   Then fill in your database URL, Clerk keys, etc.
    echo.
    copy "server\.env.example" "server\.env" >nul 2>&1
    echo   Created server\.env from template - EDIT IT with your values!
    echo.
) else (
    echo   Found server\.env
)

if not exist "client\.env" (
    echo   WARNING: client\.env file NOT found!
    copy "client\.env.example" "client\.env" >nul 2>&1
    echo   Created client\.env from template - EDIT IT with your Clerk key!
) else (
    echo   Found client\.env
)
echo   OK
echo.

:: Generate Prisma client
echo [4/8] Generating Prisma database client...
cd server
call npx prisma generate
if %errorlevel% neq 0 (
    echo   ERROR: Prisma generate failed!
    cd ..
    pause
    exit /b 1
)
echo   OK
cd ..
echo.

:: Push database schema
echo [5/8] Pushing database schema to PostgreSQL...
echo   (This creates all 70+ tables in your Neon database)
cd server
call npx prisma db push
if %errorlevel% neq 0 (
    echo   ERROR: Database push failed!
    echo   Check your DATABASE_URL in server\.env
    cd ..
    pause
    exit /b 1
)
echo   OK
cd ..
echo.

:: Install frontend dependencies
echo [6/8] Installing frontend dependencies...
cd client
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo   ERROR: Frontend install failed!
    cd ..
    pause
    exit /b 1
)
echo   OK
cd ..
echo.

:: Build frontend
echo [7/8] Building frontend for production...
cd client
call npx vite build
if %errorlevel% neq 0 (
    echo   WARNING: Frontend build failed!
    echo   Check VITE_CLERK_PUBLISHABLE_KEY in client\.env
    cd ..
) else (
    echo   OK - Built to client\dist\
    cd ..
)
echo.

:: Google Service Account check
echo [8/8] Checking Google service account...
if exist "server\google-service-account.json" (
    echo   Found google-service-account.json
) else (
    echo   WARNING: google-service-account.json NOT found in server\
    echo   Google Drive file uploads won't work without it.
    echo   Download from Google Cloud Console and place in server\ folder.
)
echo.

:: Summary
echo ============================================================
echo   SETUP COMPLETE!
echo ============================================================
echo.
echo   Before starting, make sure you've configured:
echo.
echo   1. server\.env  - Database URL, Clerk keys, Gmail, Google
echo   2. client\.env  - VITE_CLERK_PUBLISHABLE_KEY
echo   3. server\google-service-account.json (for file uploads)
echo.
echo   To start the app:
echo.
echo   Backend:   cd server ^&^& npm run dev
echo   Frontend:  cd client ^&^& npm run dev
echo.
echo   Then open: http://localhost:3000
echo.
echo   First user login? Make yourself admin:
echo     cd server ^&^& npx prisma studio
echo     Open User table, change your role to "admin"
echo.
echo ============================================================
pause
