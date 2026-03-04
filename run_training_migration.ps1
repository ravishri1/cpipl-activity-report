cd "D:\Activity Report Software\server"
Write-Host "Running Prisma database migration for PointLog model..."
npx prisma db push
Write-Host "Migration completed!"
