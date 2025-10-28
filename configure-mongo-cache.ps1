$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '===================================='
Write-Host 'WiredTiger Cache Config (4GB)'
Write-Host '===================================='
Write-Host ''

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host 'ERROR: Need admin privileges'
    exit 1
}

Write-Host 'OK: Admin verified'
Write-Host ''

$configPath = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg'

# Backup
Write-Host '[1/4] Backing up...'
$backupPath = $configPath + '.backup_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
Copy-Item $configPath $backupPath
Write-Host 'OK: Backup created'
Write-Host ''

# Modify
Write-Host '[2/4] Modifying config...'
$content = Get-Content $configPath -Raw

if ($content -match 'wiredTiger:') {
    Write-Host 'WARN: Already has wiredTiger config'
} else {
    $content = $content -replace '(storage:[\r\n]+\s+dbPath:[^\r\n]+)', '$1\r\n  wiredTiger:\r\n    engineConfig:\r\n      cacheSizeGB: 4'

    Set-Content $configPath $content -Encoding UTF8
    Write-Host 'OK: Config updated'
}

Write-Host ''

# Restart
Write-Host '[3/4] Restarting MongoDB...'
Write-Host '  Stopping...'
Stop-Service -Name MongoDB -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Write-Host '  Starting...'
Start-Service -Name MongoDB
Write-Host 'OK: Service restarted'
Write-Host ''

# Verify
Write-Host '[4/4] Verifying...'
$svc = Get-Service -Name MongoDB
if ($svc.Status -eq 'Running') {
    Write-Host 'OK: MongoDB is running'
} else {
    Write-Host 'WARN: Status:' $svc.Status
}

Write-Host ''
Write-Host '===================================='
Write-Host 'DONE!'
Write-Host '===================================='
Write-Host ''
Write-Host 'Cache Size: 4 GB'
Write-Host 'Config:' $configPath
Write-Host 'Backup:' $backupPath
Write-Host ''
Write-Host 'Run: node diagnose-mongodb-usage.js'
Write-Host ''
