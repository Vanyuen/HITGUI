# WiredTiger缓存自动配置脚本
# 自动配置为4GB，无需交互
# 使用方法: powershell -ExecutionPolicy Bypass -File configure-wiredtiger-auto.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "WiredTiger缓存自动配置 (4GB)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] 需要管理员权限" -ForegroundColor Red
    Write-Host "请以管理员身份运行PowerShell" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] 管理员权限验证通过" -ForegroundColor Green

# 查找MongoDB配置文件
Write-Host "[INFO] 正在查找MongoDB配置文件..." -ForegroundColor Cyan

$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\5.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\4.4\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\4.2\bin\mongod.cfg"
)

$configFile = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $configFile = $path
        break
    }
}

if ($null -eq $configFile) {
    Write-Host "[ERROR] 未找到MongoDB配置文件" -ForegroundColor Red
    Write-Host "查找路径:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  $path" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "[OK] 找到配置文件: $configFile" -ForegroundColor Green

# 备份配置文件
Write-Host "[INFO] 正在备份配置文件..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$configFile.backup_$timestamp"

try {
    Copy-Item $configFile $backupFile
    Write-Host "[OK] 备份成功: $(Split-Path $backupFile -Leaf)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] 备份失败: $_" -ForegroundColor Red
    exit 1
}

# 设置缓存大小为4GB
$cacheSize = 4
Write-Host "[INFO] 缓存大小设置为: $cacheSize GB" -ForegroundColor Cyan

# 读取配置文件
$content = Get-Content $configFile -Raw

# 检查并修改配置
Write-Host "[INFO] 正在修改配置..." -ForegroundColor Cyan

$modified = $false

if ($content -match "cacheSizeGB\s*:\s*\d+") {
    Write-Host "[INFO] 更新现有cacheSizeGB配置" -ForegroundColor Yellow
    $content = $content -replace "cacheSizeGB\s*:\s*\d+", "cacheSizeGB: $cacheSize"
    $modified = $true
} elseif ($content -match "engineConfig:") {
    Write-Host "[INFO] 在engineConfig中添加cacheSizeGB" -ForegroundColor Yellow
    $content = $content -replace "(engineConfig:)", "`$1`n      cacheSizeGB: $cacheSize"
    $modified = $true
} elseif ($content -match "wiredTiger:") {
    Write-Host "[INFO] 在wiredTiger中添加engineConfig" -ForegroundColor Yellow
    $content = $content -replace "(wiredTiger:)", "`$1`n    engineConfig:`n      cacheSizeGB: $cacheSize"
    $modified = $true
} elseif ($content -match "storage:") {
    Write-Host "[INFO] 在storage中添加wiredTiger配置" -ForegroundColor Yellow
    $content = $content -replace "(storage:)", "`$1`n  wiredTiger:`n    engineConfig:`n      cacheSizeGB: $cacheSize"
    $modified = $true
} else {
    Write-Host "[ERROR] 无法自动配置" -ForegroundColor Red
    Write-Host "请手动添加以下配置:" -ForegroundColor Yellow
    Write-Host "storage:" -ForegroundColor White
    Write-Host "  wiredTiger:" -ForegroundColor White
    Write-Host "    engineConfig:" -ForegroundColor White
    Write-Host "      cacheSizeGB: $cacheSize" -ForegroundColor White
    exit 1
}

if ($modified) {
    # 保存配置
    try {
        Set-Content $configFile $content
        Write-Host "[OK] 配置文件已更新" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] 保存失败: $_" -ForegroundColor Red
        Write-Host "备份文件: $backupFile" -ForegroundColor Yellow
        exit 1
    }
}

# 重启MongoDB服务
Write-Host "[INFO] 正在重启MongoDB服务..." -ForegroundColor Cyan

try {
    Write-Host "  停止MongoDB服务..." -ForegroundColor Yellow
    Stop-Service -Name MongoDB -ErrorAction Stop

    Start-Sleep -Seconds 3

    Write-Host "  启动MongoDB服务..." -ForegroundColor Yellow
    Start-Service -Name MongoDB -ErrorAction Stop

    Write-Host "[OK] MongoDB服务已重启" -ForegroundColor Green

    # 检查服务状态
    $service = Get-Service -Name MongoDB
    if ($service.Status -eq 'Running') {
        Write-Host "[OK] MongoDB服务运行正常" -ForegroundColor Green
    } else {
        Write-Host "[WARN] MongoDB服务状态: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] 服务重启失败: $_" -ForegroundColor Red
    Write-Host "可能原因: 配置文件格式错误" -ForegroundColor Yellow
    Write-Host "解决方法:" -ForegroundColor Yellow
    Write-Host "  1. 恢复备份: copy `"$backupFile`" `"$configFile`"" -ForegroundColor White
    Write-Host "  2. 查看日志: C:\data\log\mongod.log" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "配置完成！" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "配置摘要:" -ForegroundColor Cyan
Write-Host "  缓存大小: $cacheSize GB" -ForegroundColor White
Write-Host "  配置文件: $configFile" -ForegroundColor White
Write-Host "  备份文件: $backupFile" -ForegroundColor White
Write-Host ""
Write-Host "预期效果:" -ForegroundColor Cyan
Write-Host "  MongoDB内存占用: 9.2GB -> 约3.6GB" -ForegroundColor Green
Write-Host "  释放内存: 约5.6GB" -ForegroundColor Green
Write-Host "  批量预测性能: 保持不变" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  node diagnose-mongodb-usage.js" -ForegroundColor White
Write-Host ""

exit 0
