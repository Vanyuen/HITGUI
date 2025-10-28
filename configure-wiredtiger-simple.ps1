# WiredTiger缓存配置脚本 - 简化版
# 使用方法: 以管理员身份运行

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " WiredTiger缓存配置助手" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "错误: 需要管理员权限" -ForegroundColor Red
    Write-Host "请右键PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键退出"
    exit
}

Write-Host "管理员权限验证通过" -ForegroundColor Green
Write-Host ""

# 查找MongoDB配置文件
Write-Host "正在查找MongoDB配置文件..." -ForegroundColor Cyan

$possiblePaths = @(
    "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\5.0\bin\mongod.cfg",
    "C:\Program Files\MongoDB\Server\4.4\bin\mongod.cfg"
)

$configFile = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $configFile = $path
        Write-Host "找到配置文件: $configFile" -ForegroundColor Green
        break
    }
}

if ($null -eq $configFile) {
    Write-Host ""
    Write-Host "未找到MongoDB配置文件" -ForegroundColor Red
    Write-Host "常见位置:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  $path" -ForegroundColor White
    }
    Write-Host ""
    $manualPath = Read-Host "请输入mongod.cfg的完整路径 (或按回车退出)"

    if ([string]::IsNullOrWhiteSpace($manualPath)) {
        exit
    }

    if (Test-Path $manualPath) {
        $configFile = $manualPath
        Write-Host "配置文件确认: $configFile" -ForegroundColor Green
    } else {
        Write-Host "文件不存在，退出" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit
    }
}

Write-Host ""

# 备份配置文件
Write-Host "正在备份配置文件..." -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$configFile.backup_$timestamp"

try {
    Copy-Item $configFile $backupFile -ErrorAction Stop
    Write-Host "备份成功: $(Split-Path $backupFile -Leaf)" -ForegroundColor Green
} catch {
    Write-Host "备份失败: $_" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit
}

Write-Host ""

# 选择缓存大小
Write-Host "请选择WiredTiger缓存大小:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. 2GB  - 极限节省" -ForegroundColor White
Write-Host "  2. 4GB  - 推荐配置 (默认)" -ForegroundColor Green
Write-Host "  3. 6GB  - 高性能" -ForegroundColor White
Write-Host ""

$choice = Read-Host "请输入选项 (1-3, 默认2)"

if ([string]::IsNullOrWhiteSpace($choice)) {
    $choice = "2"
}

switch ($choice) {
    "1" { $cacheSize = 2 }
    "2" { $cacheSize = 4 }
    "3" { $cacheSize = 6 }
    default {
        Write-Host "无效选项，使用默认值4GB" -ForegroundColor Yellow
        $cacheSize = 4
    }
}

Write-Host ""
Write-Host "选择的缓存大小: $cacheSize GB" -ForegroundColor Green
Write-Host ""

# 修改配置文件
Write-Host "正在修改配置文件..." -ForegroundColor Cyan

$content = Get-Content $configFile -Raw

# 检查并修改配置
if ($content -match "cacheSizeGB\s*:\s*\d+") {
    Write-Host "发现现有cacheSizeGB配置，将更新为 $cacheSize GB" -ForegroundColor Yellow
    $content = $content -replace "cacheSizeGB\s*:\s*\d+", "cacheSizeGB: $cacheSize"
} elseif ($content -match "engineConfig:") {
    Write-Host "在engineConfig中添加cacheSizeGB配置" -ForegroundColor Yellow
    $content = $content -replace "(engineConfig:)", "`$1`n      cacheSizeGB: $cacheSize"
} elseif ($content -match "wiredTiger:") {
    Write-Host "在wiredTiger中添加engineConfig和cacheSizeGB配置" -ForegroundColor Yellow
    $content = $content -replace "(wiredTiger:)", "`$1`n    engineConfig:`n      cacheSizeGB: $cacheSize"
} elseif ($content -match "storage:") {
    Write-Host "在storage中添加wiredTiger配置" -ForegroundColor Yellow
    $content = $content -replace "(storage:)", "`$1`n  wiredTiger:`n    engineConfig:`n      cacheSizeGB: $cacheSize"
} else {
    Write-Host "警告: 无法自动配置，请手动添加以下内容:" -ForegroundColor Red
    Write-Host ""
    Write-Host "storage:" -ForegroundColor White
    Write-Host "  wiredTiger:" -ForegroundColor White
    Write-Host "    engineConfig:" -ForegroundColor White
    Write-Host "      cacheSizeGB: $cacheSize" -ForegroundColor White
    Write-Host ""
    Read-Host "按回车键退出"
    exit
}

# 保存配置
try {
    Set-Content $configFile $content -ErrorAction Stop
    Write-Host "配置文件已更新" -ForegroundColor Green
} catch {
    Write-Host "保存失败: $_" -ForegroundColor Red
    Write-Host "备份文件: $backupFile" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit
}

Write-Host ""

# 重启MongoDB服务
Write-Host "准备重启MongoDB服务..." -ForegroundColor Cyan
$restart = Read-Host "是否现在重启MongoDB服务? (y/n, 默认y)"

if ([string]::IsNullOrWhiteSpace($restart) -or $restart -eq 'y') {
    try {
        Write-Host ""
        Write-Host "正在停止MongoDB服务..." -ForegroundColor Yellow
        Stop-Service -Name MongoDB -ErrorAction Stop

        Write-Host "等待3秒..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3

        Write-Host "正在启动MongoDB服务..." -ForegroundColor Yellow
        Start-Service -Name MongoDB -ErrorAction Stop

        Write-Host "MongoDB服务已重启" -ForegroundColor Green
        Write-Host ""

        # 检查服务状态
        $service = Get-Service -Name MongoDB
        if ($service.Status -eq 'Running') {
            Write-Host "MongoDB服务运行正常" -ForegroundColor Green
        } else {
            Write-Host "警告: MongoDB服务状态: $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "服务重启失败: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能原因: 配置文件格式错误" -ForegroundColor Yellow
        Write-Host "解决方法: 恢复备份文件 $backupFile" -ForegroundColor Yellow
        Write-Host "查看日志: C:\data\log\mongod.log" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "按回车键退出"
        exit
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host " 配置完成！" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "配置摘要:" -ForegroundColor Cyan
Write-Host "  缓存大小: $cacheSize GB" -ForegroundColor White
Write-Host "  配置文件: $configFile" -ForegroundColor White
Write-Host "  备份文件: $backupFile" -ForegroundColor White
Write-Host ""

Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 运行诊断: node diagnose-mongodb-usage.js" -ForegroundColor White
Write-Host "  2. 启动应用: npm start" -ForegroundColor White
Write-Host ""

$memSaved = [Math]::Round(9.2 - ($cacheSize * 0.9), 1)
Write-Host "预期效果:" -ForegroundColor Cyan
Write-Host "  MongoDB内存占用: 9.2GB -> 约$($cacheSize * 0.9)GB" -ForegroundColor Green
Write-Host "  释放内存: 约${memSaved}GB" -ForegroundColor Green
Write-Host "  批量预测性能: 保持不变或略微下降(<5%)" -ForegroundColor Green
Write-Host ""

Read-Host "按回车键退出"
