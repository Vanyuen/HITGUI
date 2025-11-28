@echo off
echo Attempting to force kill Node.js processes...
echo.

:: Try to kill all node.exe processes
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"

echo.
echo Checking if Node.js processes are still running...
tasklist | findstr node.exe

if %ERRORLEVEL% EQU 0 (
    echo.
    echo WARNING: Some Node.js processes are still running.
    echo You may need to run this script as Administrator.
) else (
    echo.
    echo SUCCESS: All Node.js processes have been terminated.
)

pause
