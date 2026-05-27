@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\workstation\bootstrap-offline-project.ps1" -InstallDependencies -CopyPrivateKey -CheckPi
echo.
pause
