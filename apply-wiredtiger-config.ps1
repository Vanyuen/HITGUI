# WiredTiger配置应用脚本 - 直接执行版本
# 必须以管理员身份运行PowerShell

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "WiredTiger缓存配置 (4GB)" -ForegroundColor Yellow
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] 需要管理员权限" -ForegroundColor Red
    Write-Host "请以管理员身份运行PowerShell，然后执行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] 管理员权限验证通过" -ForegroundColor Green
Write-Host ""

$configFile = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg"

# 备份
Write-Host "[1/4] 正在备份配置文件..." -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$configFile.backup_$timestamp"

try {
    Copy-Item $configFile $backupFile
    Write-Host "[OK] 备份成功: $(Split-Path $backupFile -Leaf)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] 备份失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 修改配置
Write-Host "[2/4] 正在修改配置文件..." -ForegroundColor Cyan

$content = Get-Content $configFile -Raw

if ($content -match "wiredTiger:") {
    Write-Host "[WARN] 配置文件已包含wiredTiger设置" -ForegroundColor Yellow
} else {
    # 在 storage: dbPath 后添加 wiredTiger 配置
    $content = $content -replace "(storage:\s+dbPath:[^\r\n]+)", "`$1`r`n  wiredTiger:`r`n    engineConfig:`r`n      cacheSizeGB: 4"

    try {
        Set-Content $configFile $content -Encoding UTF8
        Write-Host "[OK] 配置文件已更新" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] 更新失败: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# 重启MongoDB服务
Write-Host "[3/4] 正在重启MongoDB服务..." -ForegroundColor Cyan

try {
    Write-Host "  停止MongoDB服务..." -ForegroundColor Yellow
    Stop-Service -Name MongoDB -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 3

    Write-Host "  启动MongoDB服务..." -ForegroundColor Yellow
    Start-Service -Name MongoDB -ErrorAction Stop

    Write-Host "[OK] MongoDB服务已重启" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] 服务重启失败: $_" -ForegroundColor Red
    Write-Host "备份文件: $backupFile" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 验证
Write-Host "[4/4] 验证配置..." -ForegroundColor Cyan

$service = Get-Service -Name MongoDB
if ($service.Status -eq 'Running') {
    Write-Host "[OK] MongoDB服务运行正常" -ForegroundColor Green
} else {
    Write-Host "[WARN] MongoDB服务状态: $($service.Status)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "配置完成！" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "配置摘要:" -ForegroundColor Cyan
Write-Host "  缓存大小: 4 GB" -ForegroundColor White
Write-Host "  配置文件: $configFile" -ForegroundColor White
Write-Host "  备份文件: $backupFile" -ForegroundColor White
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  node diagnose-mongodb-usage.js" -ForegroundColor White
Write-Host ""
