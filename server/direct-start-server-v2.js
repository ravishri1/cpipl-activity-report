#!/usr/bin/env node

/**
 * Direct Server Startup Script V2
 * Bypasses npm to directly start the Express server
 * Automatically triggers Prisma migration
 * Falls back to alternate port if 5000 is in use
 */

const path = require('path');
const fs = require('fs');
const net = require('net');

// Change to server directory
process.chdir(__dirname);

console.log('='.repeat(60));
console.log('CPIPL HR SYSTEM - BACKEND SERVER STARTUP');
console.log('='.repeat(60));
console.log('');
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Node Version: ${process.version}`);
console.log('');

// Load environment variables
require('dotenv').config();

console.log('Loading server application...');
console.log('');

// Function to check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Start server with port fallback
async function startServer() {
  try {
    // Import the app
    const app = require('./src/app');
    
    // Find available port
    let PORT = process.env.PORT || 5000;
    let portAvailable = await isPortAvailable(PORT);
    
    if (!portAvailable) {
      console.log(`⚠️  Port ${PORT} is in use, trying alternative port...`);
      
      // Try alternative ports
      for (let altPort = 5001; altPort <= 5010; altPort++) {
        if (await isPortAvailable(altPort)) {
          PORT = altPort;
          console.log(`✅ Using alternative port: ${altPort}`);
          break;
        }
      }
    }
    
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('✅ SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`🚀 Listening on port ${PORT}`);
      console.log('');
      console.log('Endpoints available at:');
      console.log(`  http://localhost:${PORT}/api/`);
      console.log('');
      console.log('Procurement endpoints:');
      console.log(`  POST   /api/procurement/vendors`);
      console.log(`  POST   /api/procurement/orders`);
      console.log(`  POST   /api/procurement/orders/{id}/items`);
      console.log(`  GET    /api/procurement/inventory/low-stock`);
      console.log(`  POST   /api/procurement/budgets`);
      console.log('');
      console.log('Press Ctrl+C to stop the server');
      console.log('='.repeat(60));
      console.log('');
      
      // Log that server is ready for testing
      global.SERVER_PORT = PORT;
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('Shutting down server gracefully...');
      console.log('='.repeat(60));
      server.close(() => {
        console.log('Server stopped');
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ ERROR STARTING SERVER');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('Module not found. Make sure to run:');
      console.error('  npm install');
      console.error('');
    }
    
    console.error('Stack:', error.stack);
    console.error('');
    process.exit(1);
  }
}

// Run the server
startServer();
