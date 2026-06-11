@echo off
setlocal

set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\workstation\publish-local-to-github.ps1" -Message "chore: publish local project"

echo.
pause
