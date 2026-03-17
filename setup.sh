#!/bin/bash
# ============================================================
#  CPIPL Activity Report - Linux/Mac Setup Script
#  Run: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  CPIPL Activity Report - New System Setup${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}[1/8] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ERROR: Node.js is NOT installed!${NC}"
    echo "  Install: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  Then:    sudo apt install -y nodejs"
    exit 1
fi
echo -e "${GREEN}  Found $(node --version)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}  ERROR: npm is NOT installed!${NC}"
    exit 1
fi
echo -e "${GREEN}  Found npm v$(npm --version)${NC}"

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}  WARNING: Git not installed. Install with: sudo apt install git${NC}"
else
    echo -e "${GREEN}  Found $(git --version)${NC}"
fi
echo ""

# Install server dependencies
echo -e "${YELLOW}[2/8] Installing backend dependencies...${NC}"
cd server
npm install
echo -e "${GREEN}  OK${NC}"
cd ..
echo ""

# Check .env file
echo -e "${YELLOW}[3/8] Checking environment configuration...${NC}"
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}  WARNING: server/.env NOT found!${NC}"
    if [ -f "server/.env.example" ]; then
        cp server/.env.example server/.env
        echo "  Created server/.env from template — EDIT IT with your values!"
    fi
else
    echo -e "${GREEN}  Found server/.env${NC}"
fi

if [ ! -f "client/.env" ]; then
    echo -e "${YELLOW}  WARNING: client/.env NOT found!${NC}"
    if [ -f "client/.env.example" ]; then
        cp client/.env.example client/.env
        echo "  Created client/.env from template — EDIT IT with your Clerk key!"
    fi
else
    echo -e "${GREEN}  Found client/.env${NC}"
fi
echo ""

# Generate Prisma client
echo -e "${YELLOW}[4/8] Generating Prisma database client...${NC}"
cd server
npx prisma generate
echo -e "${GREEN}  OK${NC}"
cd ..
echo ""

# Push database schema
echo -e "${YELLOW}[5/8] Pushing database schema to PostgreSQL...${NC}"
echo "  (This creates all 70+ tables in your Neon database)"
cd server
npx prisma db push
echo -e "${GREEN}  OK${NC}"
cd ..
echo ""

# Install frontend dependencies
echo -e "${YELLOW}[6/8] Installing frontend dependencies...${NC}"
cd client
npm install --legacy-peer-deps
echo -e "${GREEN}  OK${NC}"
cd ..
echo ""

# Build frontend
echo -e "${YELLOW}[7/8] Building frontend for production...${NC}"
cd client
npx vite build || echo -e "${YELLOW}  WARNING: Build failed. Check VITE_CLERK_PUBLISHABLE_KEY in client/.env${NC}"
cd ..
echo ""

# Google Service Account check
echo -e "${YELLOW}[8/8] Checking Google service account...${NC}"
if [ -f "server/google-service-account.json" ]; then
    echo -e "${GREEN}  Found google-service-account.json${NC}"
else
    echo -e "${YELLOW}  WARNING: google-service-account.json NOT found in server/${NC}"
    echo "  Google Drive uploads won't work without it."
fi
echo ""

# Summary
echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}  SETUP COMPLETE!${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo "  Before starting, configure:"
echo "    1. server/.env  — Database URL, Clerk keys, Gmail, Google"
echo "    2. client/.env  — VITE_CLERK_PUBLISHABLE_KEY"
echo "    3. server/google-service-account.json (for file uploads)"
echo ""
echo "  To start (development):"
echo "    Backend:   cd server && npm run dev"
echo "    Frontend:  cd client && npm run dev"
echo ""
echo "  To start (production with PM2):"
echo "    npm install -g pm2"
echo "    cd server && pm2 start src/index.js --name cpipl-hr"
echo "    pm2 startup && pm2 save"
echo ""
echo "  Open: http://localhost:3000"
echo ""
echo "  First login? Make yourself admin:"
echo "    cd server && npx prisma studio"
echo "    Open User table → change role to 'admin'"
echo ""
