@echo off
chcp 65001 >nul
setlocal

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure_petnova_cloudinary.ps1"
set "PETNOVA_EXIT=%ERRORLEVEL%"

if not "%PETNOVA_EXIT%"=="0" (
    echo.
    pause
)

exit /b %PETNOVA_EXIT%
