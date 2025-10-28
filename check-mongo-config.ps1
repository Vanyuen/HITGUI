$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Checking MongoDB Service Configuration...'
Write-Host ''

# Get service details
$service = Get-WmiObject Win32_Service | Where-Object {$_.Name -eq 'MongoDB'}

if ($service) {
    Write-Host 'Service PathName:'
    Write-Host $service.PathName
    Write-Host ''

    # Extract config file path from command line
    if ($service.PathName -match '--config\s+"([^"]+)"') {
        $configPath = $matches[1]
        Write-Host "Config file: $configPath"
        Write-Host ''

        if (Test-Path $configPath) {
            Write-Host 'Current config content (storage section):'
            Write-Host '----------------------------------------'
            Get-Content $configPath | Select-String -Context 0,5 -Pattern 'storage:'
        }
    } else {
        Write-Host 'WARN: No --config parameter found'
        Write-Host 'Service might be using default config location'
    }
} else {
    Write-Host 'ERROR: MongoDB service not found'
}

Write-Host ''
