@echo off
echo Starting diplom-sed...

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed!
  pause
  exit /b 1
)

if not exist ".env" (
  echo Creating default .env file...
  echo DATABASE_URL="file:./prisma/dev.db"> .env
  echo AUTH_SECRET="change-me-to-a-random-32-char-string">> .env
)

echo [2/5] Applying migrations...
call npx prisma migrate deploy
if errorlevel 1 (
  echo Migration failed!
  pause
  exit /b 1
)

echo [3/5] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
  echo Prisma generate failed!
  pause
  exit /b 1
)

echo [4/5] Seeding database...
call npm run prisma:seed
if errorlevel 1 (
  echo Seed failed!
  pause
  exit /b 1
)

echo [5/5] Starting dev server...
call npm run dev
