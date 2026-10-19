@echo off
title Digi-Action Local Server
echo ========================================================
echo Menjalankan Digi-Action di http://localhost:8080/
echo ========================================================

where node >nul 2>nul
if %errorlevel% equ 0 (
    node "%~dp0server.js"
    goto end
)

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" "%~dp0server.js"
    goto end
)

echo [INFO] Node.js tidak terdeteksi di PATH, menggunakan PowerShell web server...
powershell -ExecutionPolicy Bypass -File "%~dp0run-local.ps1"

:end
pause
