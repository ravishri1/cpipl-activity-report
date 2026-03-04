Set-Location "D:\Activity Report Software\server"
Write-Host "Checking migration status..."
$schema = Get-Content "prisma\schema.prisma" -Raw

if ($schema -match "model TrainingAssignment") {
    Write-Host "✅ TrainingAssignment model found in schema"
} else {
    Write-Host "❌ TrainingAssignment model NOT found"
}

if ($schema -match "model TrainingContribution") {
    Write-Host "✅ TrainingContribution model found in schema"
} else {
    Write-Host "❌ TrainingContribution model NOT found"
}

$dbFile = Get-Item "prisma\dev.db" -ErrorAction SilentlyContinue
if ($dbFile) {
    Write-Host "✅ Database file exists ($(($dbFile.Length/1024).ToString('N2')) KB)"
    Write-Host "   Last modified: $($dbFile.LastWriteTime)"
} else {
    Write-Host "⚠️ Database file not found"
}

Write-Host "`nMigration status: Ready for testing"
Write-Host "Next step: Run 'npm run dev' to start backend and verify tables"
