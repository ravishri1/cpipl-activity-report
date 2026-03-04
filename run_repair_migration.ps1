Set-Location "D:\Activity Report Software\server"
Write-Host "Running Prisma migration for repair system..." -ForegroundColor Cyan
npx prisma migrate dev --name add_repair_system
Write-Host "Migration completed." -ForegroundColor Green
