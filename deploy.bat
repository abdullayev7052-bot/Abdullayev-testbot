@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo O'zgarishlar GitHub'ga yuborilmoqda (Railway avtomatik deploy qiladi)...
git add -A
git commit -m "Yangilanish %date% %time%"
git push
echo.
echo Tayyor. Railway 2-4 daqiqada yangi versiyani ishga tushiradi.
pause
