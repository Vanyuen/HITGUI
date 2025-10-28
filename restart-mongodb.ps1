$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Restarting MongoDB to apply cache config...'
Write-Host ''

try {
    Write-Host 'Stopping MongoDB...'
    Stop-Service -Name MongoDB -Force

    Write-Host 'Waiting 5 seconds...'
    Start-Sleep -Seconds 5

    Write-Host 'Starting MongoDB...'
    Start-Service -Name MongoDB

    Write-Host 'Waiting 3 seconds...'
    Start-Sleep -Seconds 3

    $svc = Get-Service -Name MongoDB
    if ($svc.Status -eq 'Running') {
        Write-Host 'OK: MongoDB is running' -ForegroundColor Green
    } else {
        Write-Host "WARN: Status is $($svc.Status)" -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'DONE! Run: node diagnose-mongodb-usage.js'
    Write-Host ''

} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host ''
    Write-Host 'Please restart manually:'
    Write-Host '  1. Press Win+R'
    Write-Host '  2. Type: services.msc'
    Write-Host '  3. Find MongoDB, right-click, Restart'
    Write-Host ''
}
