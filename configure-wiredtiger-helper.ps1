# WiredTiger缓存配置助手脚本
# 使用方法: 以管理员身份运行PowerShell，然后执行此脚本

Write-Host "`n" -NoNewline
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " WiredTiger缓存配置助手" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 错误: 需要管理员权限" -ForegroundColor Red
    Write-Host "   请右键PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键退出"
    exit
}

Write-Host "✅ 管理员权限验证通过`n" -ForegroundColor Green

# 第1步: 查找mongod.cfg
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第1步: 查找MongoDB配置文件" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

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
        Write-Host "✅ 找到配置文件: $configFile" -ForegroundColor Green
        break
    }
}

if ($null -eq $configFile) {
    Write-Host "❌ 未找到MongoDB配置文件" -ForegroundColor Red
    Write-Host "`n请手动查找mongod.cfg文件:" -ForegroundColor Yellow
    Write-Host "  1. 打开任务管理器" -ForegroundColor White
    Write-Host "  2. 找到mongod.exe进程" -ForegroundColor White
    Write-Host "  3. 右键 → '打开文件所在位置'" -ForegroundColor White
    Write-Host "  4. mongod.cfg应该在同一目录`n" -ForegroundColor White

    $manualPath = Read-Host "请输入mongod.cfg的完整路径 (或按回车退出)"

    if ([string]::IsNullOrWhiteSpace($manualPath)) {
        exit
    }

    if (Test-Path $manualPath) {
        $configFile = $manualPath
        Write-Host "✅ 配置文件确认: $configFile`n" -ForegroundColor Green
    } else {
        Write-Host "❌ 文件不存在，退出`n" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit
    }
}

# 第2步: 备份配置文件
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第2步: 备份配置文件" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$configFile.backup_$timestamp"

try {
    Copy-Item $configFile $backupFile -ErrorAction Stop
    Write-Host "✅ 备份创建成功: $(Split-Path $backupFile -Leaf)`n" -ForegroundColor Green
} catch {
    Write-Host "❌ 备份失败: $_`n" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit
}

# 第3步: 读取配置文件
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第3步: 分析配置文件" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

$content = Get-Content $configFile -Raw

# 检查是否已有cacheSizeGB配置
if ($content -match "cacheSizeGB\s*:\s*\d+") {
    Write-Host "⚠️  警告: 配置文件中已存在cacheSizeGB设置" -ForegroundColor Yellow
    Write-Host "当前配置: $($matches[0])`n" -ForegroundColor White

    $overwrite = Read-Host "是否覆盖现有配置? (y/n)"
    if ($overwrite -ne 'y') {
        Write-Host "操作已取消`n" -ForegroundColor Yellow
        Read-Host "按回车键退出"
        exit
    }
}

# 第4步: 选择缓存大小
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第4步: 选择缓存大小" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

Write-Host "请选择WiredTiger缓存大小:`n" -ForegroundColor White

Write-Host "  1. 2GB  - 极限节省 (电脑内存≤8GB)" -ForegroundColor White
Write-Host "  2. 4GB  - 推荐配置 (平衡性能与内存)" -ForegroundColor Green
Write-Host "  3. 6GB  - 高性能 (电脑内存≥32GB)" -ForegroundColor White
Write-Host "  4. 自定义" -ForegroundColor White
Write-Host ""

$choice = Read-Host "请输入选项 (1-4)"

switch ($choice) {
    "1" { $cacheSize = 2 }
    "2" { $cacheSize = 4 }
    "3" { $cacheSize = 6 }
    "4" {
        $cacheSize = Read-Host "请输入缓存大小 (单位: GB)"
        if (-not ($cacheSize -match '^\d+$')) {
            Write-Host "❌ 无效输入，使用默认值4GB`n" -ForegroundColor Red
            $cacheSize = 4
        }
    }
    default {
        Write-Host "❌ 无效选项，使用默认值4GB`n" -ForegroundColor Yellow
        $cacheSize = 4
    }
}

Write-Host "`n✅ 选择的缓存大小: $cacheSize GB`n" -ForegroundColor Green

# 第5步: 修改配置文件
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第5步: 修改配置文件" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

# 检查是否已有wiredTiger配置
if ($content -match "wiredTiger:") {
    # 已有wiredTiger配置
    if ($content -match "engineConfig:") {
        # 已有engineConfig
        if ($content -match "cacheSizeGB\s*:\s*\d+") {
            # 替换现有值
            $content = $content -replace "cacheSizeGB\s*:\s*\d+", "cacheSizeGB: $cacheSize"
            Write-Host "✅ 已更新现有cacheSizeGB配置" -ForegroundColor Green
        } else {
            # 添加cacheSizeGB到engineConfig
            $content = $content -replace "(engineConfig:)", "`$1`n      cacheSizeGB: $cacheSize"
            Write-Host "✅ 已添加cacheSizeGB到engineConfig" -ForegroundColor Green
        }
    } else {
        # 添加engineConfig
        $content = $content -replace "(wiredTiger:)", "`$1`n    engineConfig:`n      cacheSizeGB: $cacheSize"
        Write-Host "✅ 已添加engineConfig和cacheSizeGB" -ForegroundColor Green
    }
} else {
    # 没有wiredTiger配置，添加完整配置
    if ($content -match "storage:") {
        $content = $content -replace "(storage:)", "`$1`n  wiredTiger:`n    engineConfig:`n      cacheSizeGB: $cacheSize"
        Write-Host "✅ 已添加完整WiredTiger配置" -ForegroundColor Green
    } else {
        Write-Host "❌ 配置文件格式异常，无法自动配置" -ForegroundColor Red
        Write-Host "   请手动添加以下配置到storage部分:`n" -ForegroundColor Yellow
        Write-Host "storage:" -ForegroundColor White
        Write-Host "  wiredTiger:" -ForegroundColor White
        Write-Host "    engineConfig:" -ForegroundColor White
        Write-Host "      cacheSizeGB: $cacheSize`n" -ForegroundColor White
        Read-Host "按回车键退出"
        exit
    }
}

# 保存配置文件
try {
    Set-Content $configFile $content -ErrorAction Stop
    Write-Host "✅ 配置文件已更新`n" -ForegroundColor Green
} catch {
    Write-Host "❌ 保存失败: $_`n" -ForegroundColor Red
    Write-Host "备份文件: $backupFile`n" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit
}

# 第6步: 重启MongoDB服务
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "第6步: 重启MongoDB服务" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

$restart = Read-Host "是否现在重启MongoDB服务? (y/n)"

if ($restart -eq 'y') {
    try {
        Write-Host "`n正在停止MongoDB服务..." -ForegroundColor Yellow
        Stop-Service -Name MongoDB -ErrorAction Stop

        Write-Host "等待3秒..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3

        Write-Host "正在启动MongoDB服务..." -ForegroundColor Yellow
        Start-Service -Name MongoDB -ErrorAction Stop

        Write-Host "✅ MongoDB服务已重启`n" -ForegroundColor Green

        # 检查服务状态
        $service = Get-Service -Name MongoDB
        if ($service.Status -eq 'Running') {
            Write-Host "✅ MongoDB服务运行正常" -ForegroundColor Green
        } else {
            Write-Host "⚠️  警告: MongoDB服务状态: $($service.Status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ 服务重启失败: $_" -ForegroundColor Red
        Write-Host "`n可能原因:" -ForegroundColor Yellow
        Write-Host "  1. 配置文件格式错误" -ForegroundColor White
        Write-Host "  2. 权限不足" -ForegroundColor White
        Write-Host "`n解决方法:" -ForegroundColor Yellow
        Write-Host "  1. 恢复备份文件: $backupFile" -ForegroundColor White
        Write-Host "  2. 检查MongoDB日志: C:\data\log\mongod.log`n" -ForegroundColor White
        Read-Host "按回车键退出"
        exit
    }
} else {
    Write-Host "`n⚠️  请记得手动重启MongoDB服务:" -ForegroundColor Yellow
    Write-Host "   net stop MongoDB" -ForegroundColor White
    Write-Host "   net start MongoDB`n" -ForegroundColor White
}

# 完成
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "🎉 配置完成！" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

Write-Host "配置摘要:" -ForegroundColor Cyan
Write-Host "  缓存大小: $cacheSize GB" -ForegroundColor White
Write-Host "  配置文件: $configFile" -ForegroundColor White
Write-Host "  备份文件: $backupFile`n" -ForegroundColor White

Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 运行诊断脚本验证: node diagnose-mongodb-usage.js" -ForegroundColor White
Write-Host "  2. 启动应用测试: npm start" -ForegroundColor White
Write-Host "  3. 观察任务管理器中MongoDB内存占用`n" -ForegroundColor White

Write-Host "预期效果:" -ForegroundColor Cyan
Write-Host "  ✅ MongoDB内存占用: 9.2GB → $(($cacheSize * 0.9).ToString('0.0'))GB" -ForegroundColor Green
Write-Host "  ✅ 批量预测性能: 保持不变或略微下降(<5%)" -ForegroundColor Green
Write-Host "  ✅ 系统可用内存: 增加约$(9.2 - ($cacheSize * 0.9) | ForEach-Object { $_.ToString('0.0') })GB`n" -ForegroundColor Green

Read-Host "按回车键退出"
