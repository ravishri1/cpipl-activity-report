# Asset Repair System - Run Test Suite
# This script starts in the server directory and executes the test suite

Push-Location "D:\Activity Report Software\server"
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Running Asset Repair test suite..." -ForegroundColor Yellow
Write-Host ""

# Run the test suite
& "C:\Program Files\nodejs\node.exe" tests/repair-endpoints.test.js

Pop-Location
