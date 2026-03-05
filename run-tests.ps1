#!/usr/bin/env powershell
# Navigate to server directory and run tests

Set-Location "D:\Activity Report Software\server"
Write-Host "Current directory: $(Get-Location)"
Write-Host "Running predictions tests..."
Write-Host ""

# Run the test runner
& node run-and-log-tests.js

Write-Host ""
Write-Host "Test execution completed"
