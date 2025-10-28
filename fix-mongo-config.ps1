$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Fixing MongoDB Configuration...'
Write-Host ''

$configPath = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg'

# Find latest backup
$backups = Get-ChildItem "$configPath.backup_*" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 0) {
    $latestBackup = $backups[0].FullName
    Write-Host "Restoring from backup: $latestBackup"
    Copy-Item $latestBackup $configPath -Force
    Write-Host 'OK: Backup restored'
} else {
    Write-Host 'WARN: No backup found, will fix current file'
}

Write-Host ''

# Read and fix
$lines = Get-Content $configPath

# Find storage section and rebuild it
$newLines = @()
$inStorage = $false
$storageAdded = $false

foreach ($line in $lines) {
    if ($line -match '^storage:') {
        $inStorage = $true
        $newLines += $line
        continue
    }

    if ($inStorage -and $line -match '^\s+dbPath:') {
        # Add dbPath and wiredTiger config
        $newLines += $line
        $newLines += '  wiredTiger:'
        $newLines += '    engineConfig:'
        $newLines += '      cacheSizeGB: 4'
        $storageAdded = $true
        $inStorage = $false
        continue
    }

    if ($inStorage -and $line -match '^\s+wiredTiger:') {
        # Skip if already has wiredTiger (malformed)
        $inStorage = $false
        continue
    }

    if ($line -match '^[a-zA-Z]' -and $inStorage) {
        $inStorage = $false
    }

    # Skip malformed line
    if ($line -match '\\r\\n') {
        continue
    }

    $newLines += $line
}

# Write corrected config
$newLines | Out-File $configPath -Encoding UTF8
Write-Host 'OK: Config file corrected'
Write-Host ''

# Try to start MongoDB
Write-Host 'Starting MongoDB...'
try {
    Start-Service -Name MongoDB
    Write-Host 'OK: MongoDB started successfully'
} catch {
    Write-Host 'ERROR: Could not start MongoDB'
    Write-Host ''
    Write-Host 'Check log file:'
    Write-Host '  E:\Program Files\MongoDB\Server\8.0\log\mongod.log'
    Write-Host ''
    Write-Host 'Last 20 lines of log:'
    Get-Content 'E:\Program Files\MongoDB\Server\8.0\log\mongod.log' -Tail 20
    exit 1
}

Write-Host ''
Write-Host 'DONE!'
Write-Host ''
