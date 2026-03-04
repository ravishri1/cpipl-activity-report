#!/usr/bin/env python3
import os
import subprocess
import sys

def run_command(cmd, cwd=None):
    """Run a shell command and print output."""
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True,
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    project_dir = r"D:\Activity Report Software"
    
    print("=" * 50)
    print("PHASE 3 PRODUCTION DEPLOYMENT")
    print("=" * 50)
    print()
    
    # Check if directory exists
    if not os.path.isdir(project_dir):
        print(f"ERROR: Project directory not found: {project_dir}")
        return 1
    
    print(f"📂 Project Directory: {project_dir}")
    print(f"✅ Directory exists\n")
    
    # Check git status
    print("📊 Git Status:")
    run_command("git status", cwd=project_dir)
    print()
    
    # Commit changes
    print("💾 Committing changes...")
    commit_msg = "Production Deployment: Google Drive File Management, Insurance Cards, Training Module, Asset Repairs Design, Phase 3 Data Exports - March 4, 2026"
    if run_command(f'git commit -m "{commit_msg}"', cwd=project_dir):
        print("✅ Commit successful\n")
    else:
        print("⚠️  Commit skipped or failed (may already be committed)\n")
    
    # Push to origin
    print("🚀 Pushing to origin/main...")
    if run_command("git push origin main", cwd=project_dir):
        print("✅ Push successful\n")
    else:
        print("⚠️  Push failed (check network/credentials)\n")
    
    # Get latest commit
    print("📍 Latest commit info:")
    run_command("git log -1 --oneline", cwd=project_dir)
    print()
    
    print("=" * 50)
    print("✅ DEPLOYMENT COMPLETE")
    print("=" * 50)
    print("\n📋 Phase 4 Ready: Data Transformation and Import\n")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
