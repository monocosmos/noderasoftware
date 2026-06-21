@echo off
setlocal

set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\workstation\publish-to-pi.ps1" -IncludeDownloads -SkipDatabaseSchemaPush -UpdateLandingPage

echo.
pause
