$ErrorActionPreference = 'SilentlyContinue'

Write-Host ''
Write-Host 'Checking MongoDB Log for WiredTiger Config...'
Write-Host ''

$logPath = 'E:\Program Files\MongoDB\Server\8.0\log\mongod.log'

if (Test-Path $logPath) {
    Write-Host 'Searching for WiredTiger cache configuration in log...'
    Write-Host ''

    # Get last 500 lines and search for cache-related entries
    $lines = Get-Content $logPath -Tail 500

    Write-Host '=== WiredTiger Cache Settings ==='
    $lines | Select-String -Pattern 'wiredTiger|cache|cacheSizeGB' -CaseSensitive:$false | Select-Object -Last 20

    Write-Host ''
    Write-Host '=== Recent Startup Messages ==='
    $lines | Select-String -Pattern 'starting|config|options' -CaseSensitive:$false | Select-Object -Last 10

} else {
    Write-Host "ERROR: Log file not found at: $logPath"
}

Write-Host ''
