@echo off
echo Starting diplom-sed...

echo [1/3] Applying migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo Migration failed!
  pause
  exit /b 1
)

echo [2/3] Seeding database...
call npm run prisma:seed
if errorlevel 1 (
  echo Seed failed!
  pause
  exit /b 1
)

echo [3/3] Starting dev server...
call npm run dev
