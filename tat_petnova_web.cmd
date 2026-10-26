@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tat_petnova_web.ps1"
if errorlevel 1 pause
