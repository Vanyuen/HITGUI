$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '======================================'
Write-Host 'MongoDB Connection Fix'
Write-Host '======================================'
Write-Host ''

Write-Host 'PROBLEM FOUND:'
Write-Host '  Your app is connecting to MongoDB Memory Server (PID 31720)'
Write-Host '  instead of Windows Service MongoDB (PID 27848 with 4GB cache)'
Write-Host ''

Write-Host 'SOLUTION:'
Write-Host '  1. Stop MongoDB Memory Server process'
Write-Host '  2. Restart your application'
Write-Host '  3. App will connect to Windows Service MongoDB (4GB cache)'
Write-Host ''

$confirm = Read-Host 'Stop MongoDB Memory Server now? (y/n)'

if ($confirm -eq 'y') {
    try {
        Write-Host ''
        Write-Host 'Stopping MongoDB Memory Server (PID 31720)...'
        Stop-Process -Id 31720 -Force
        Write-Host 'OK: Process stopped' -ForegroundColor Green
        Write-Host ''
        Write-Host 'Next steps:' -ForegroundColor Cyan
        Write-Host '  1. Close any running Electron app'
        Write-Host '  2. Run: npm start'
        Write-Host '  3. App will now use Windows Service MongoDB (4GB cache)'
        Write-Host ''
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        Write-Host ''
        Write-Host 'Manual solution:'
        Write-Host '  1. Open Task Manager'
        Write-Host '  2. Find mongod.exe process (PID 31720)'
        Write-Host '  3. End task'
        Write-Host ''
    }
} else {
    Write-Host 'Cancelled'
}

Write-Host ''
