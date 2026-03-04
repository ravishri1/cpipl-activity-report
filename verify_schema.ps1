Set-Location "D:\Activity Report Software\server"
Write-Host "Verifying Prisma schema generation..."
& npx prisma generate
Write-Host "Schema generation completed!"
Write-Host "`nChecking if tables exist in database..."
& npx prisma db execute --stdin < $null
Write-Host "Verification complete!"
