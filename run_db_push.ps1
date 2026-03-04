Set-Location "D:\Activity Report Software\server"
Write-Host "Starting database push..."
& npx prisma db push
Write-Host "Database push completed!"
