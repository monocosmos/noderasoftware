@echo off
setlocal

set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\workstation\deploy-pi-from-github.ps1" -Section hotel

echo.
pause
