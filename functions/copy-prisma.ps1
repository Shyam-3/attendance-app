# Copy Prisma schema and migrations to functions directory
Copy-Item -Path ".\backend\prisma" -Destination ".\functions\" -Recurse -Force
Write-Host "Prisma files copied to functions directory" -ForegroundColor Green
