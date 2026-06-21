@echo off
setlocal

set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\pi\deploy-videowall-to-pi.ps1"

echo.
pause
