@echo off
chcp 65001 >nul
title Bito Telegram Shop
cd /d "%~dp0"

echo ===============================================
echo   Bito Telegram Shop - ishga tushirilmoqda
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [XATO] Node.js topilmadi. https://nodejs.org dan LTS versiyani o'rnating.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/4] Paketlar o'rnatilmoqda ^(birinchi marta 2-3 daqiqa^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo [XATO] npm install muvaffaqiyatsiz & pause & exit /b 1 )
  call npm approve-scripts prisma @prisma/client @prisma/engines esbuild >nul 2>nul
  call npm rebuild esbuild @prisma/engines prisma >nul 2>nul
  echo [2/4] Baza tayyorlanmoqda...
  call npm run db:generate
  call npm run db:push
  call npm run db:seed
) else (
  echo [1/4] Paketlar mavjud.
  echo [2/4] Baza tekshirilmoqda...
  call npm run db:check >nul
)

if not exist "miniapp\dist\index.html" (
  echo [3/4] Mini App va Admin panel build qilinmoqda...
  call npm run build
) else (
  echo [3/4] Build mavjud. ^(Qayta build: npm run build^)
)

echo [4/4] Server ishga tushmoqda...
echo.
echo   Admin panel:  http://localhost:4000/admin/
echo   ngrok uchun:  ngrok http 4000   ^(alohida oynada^)
echo.
call npm start
pause
