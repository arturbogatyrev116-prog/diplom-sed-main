@echo off
echo Starting diplom-sed...

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed!
  pause
  exit /b 1
)

echo [2/4] Applying migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo Migration failed!
  pause
  exit /b 1
)

echo [3/4] Seeding database...
call npm run prisma:seed
if errorlevel 1 (
  echo Seed failed!
  pause
  exit /b 1
)

echo [4/4] Starting dev server...
call npm run dev
