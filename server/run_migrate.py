#!/usr/bin/env python3
"""
Migration Script: Add Procurement Integration
Runs: npx prisma migrate dev --name add_procurement_integration
"""

import subprocess
import os
import sys

# Change to server directory
os.chdir(r"D:\Activity Report Software\server")

print("\n🚀 Starting Procurement Integration Migration...\n")

# Run the migration
cmd = [
    "npx",
    "prisma",
    "migrate",
    "dev",
    "--name",
    "add_procurement_integration"
]

try:
    result = subprocess.run(cmd, check=True, capture_output=False, text=True)
    
    print("\n✅ Migration completed successfully!")
    print("\n📊 Schema Changes Applied:")
    print("  • User model: Added 5 procurement relations")
    print("  • Asset model: Added 4 procurement fields + 1 relation")
    print("  • Database: Ready for API endpoints\n")
    
    sys.exit(0)
    
except subprocess.CalledProcessError as e:
    print(f"\n❌ Migration failed with error code {e.returncode}")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)
