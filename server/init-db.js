#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple database initialization
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
console.log(`[INIT] Database path: ${dbPath}`);

// Check if database exists
const exists = fs.existsSync(dbPath);
console.log(`[INIT] Database exists: ${exists}`);

// Import and initialize Prisma
console.log('[INIT] Loading Prisma client...');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initializeDatabase() {
  try {
    console.log('[INIT] Testing database connection...');
    
    // Test connection by doing a simple query
    const test = await prisma.$executeRawUnsafe('SELECT 1');
    console.log('[INIT] ✅ Database connection successful');

    // Test User table - this will help us know if schema was created
    try {
      const userCount = await prisma.user.count();
      console.log(`[INIT] ✅ User table exists with ${userCount} records`);
    } catch (err) {
      console.log(`[INIT] ⚠️  User table does not exist yet: ${err.code || err.message}`);
      console.log('[INIT] Prisma will need to create the schema...');
    }

    console.log('[INIT] Database initialization check complete');
    process.exit(0);
  } catch (error) {
    console.error('[INIT] ❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
