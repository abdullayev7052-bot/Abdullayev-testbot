@echo off
chcp 65001 >nul
title ngrok - Bito Telegram Shop
cd /d "%~dp0"

where ngrok >nul 2>nul
if errorlevel 1 (
  echo [XATO] ngrok topilmadi.
  echo O'rnatish: PowerShell'da   winget install ngrok.ngrok
  echo yoki https://ngrok.com/download dan yuklab, ngrok.exe ni shu papkaga qo'ying.
  pause
  exit /b 1
)

set DOMAIN=https://exerciser-greeter-reveal.ngrok-free.dev
if exist "ngrok-domain.txt" set /p DOMAIN=<ngrok-domain.txt

if "%DOMAIN%"=="" (
  echo Doimiy domen yo'q. Vaqtinchalik manzil bilan ishga tushmoqda...
  echo ^(Doimiy bepul domen olish: README.md, "ngrok" bo'limi^)
  ngrok http 4000
) else (
  echo Doimiy domen: %DOMAIN%
  ngrok http --url=%DOMAIN% 4000
)
pause
