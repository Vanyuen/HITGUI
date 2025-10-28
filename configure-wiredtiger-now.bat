@echo off
echo ====================================
echo WiredTiger缓存配置脚本
echo ====================================
echo.

REM 检查管理员权限
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] 管理员权限验证通过
) else (
    echo [ERROR] 需要管理员权限
    echo 请右键此文件，选择"以管理员身份运行"
    pause
    exit /b 1
)

echo.
echo [1/4] 正在备份配置文件...
set CONFIG_FILE=C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg
set BACKUP_FILE=%CONFIG_FILE%.backup_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_FILE=%BACKUP_FILE: =0%

copy "%CONFIG_FILE%" "%BACKUP_FILE%" >nul
if %errorLevel% == 0 (
    echo [OK] 备份成功
) else (
    echo [ERROR] 备份失败
    pause
    exit /b 1
)

echo.
echo [2/4] 正在修改配置文件...

REM 创建临时配置文件
set TEMP_FILE=%TEMP%\mongod_temp.cfg

REM 读取原配置并添加wiredTiger配置
powershell -Command "$content = Get-Content '%CONFIG_FILE%' -Raw; if ($content -match 'wiredTiger:') { Write-Host '[WARN] 配置文件已包含wiredTiger设置'; exit 1 } else { $content = $content -replace '(storage:\s+dbPath:[^\r\n]+)', '$1`r`n  wiredTiger:`r`n    engineConfig:`r`n      cacheSizeGB: 4'; Set-Content '%TEMP_FILE%' $content -Encoding UTF8; exit 0 }"

if %errorLevel% == 1 (
    echo [WARN] 配置文件已包含wiredTiger设置，跳过修改
    goto RESTART
)

REM 替换原配置文件
copy /Y "%TEMP_FILE%" "%CONFIG_FILE%" >nul
if %errorLevel% == 0 (
    echo [OK] 配置文件已更新
) else (
    echo [ERROR] 更新失败
    pause
    exit /b 1
)

:RESTART
echo.
echo [3/4] 正在重启MongoDB服务...

REM 停止MongoDB服务
echo   停止MongoDB服务...
net stop MongoDB >nul 2>&1

REM 等待3秒
timeout /t 3 /nobreak >nul

REM 启动MongoDB服务
echo   启动MongoDB服务...
net start MongoDB >nul 2>&1

if %errorLevel% == 0 (
    echo [OK] MongoDB服务已重启
) else (
    echo [ERROR] 服务重启失败
    echo 请检查配置文件格式是否正确
    echo 备份文件: %BACKUP_FILE%
    pause
    exit /b 1
)

echo.
echo [4/4] 验证配置...
sc query MongoDB | find "RUNNING" >nul
if %errorLevel% == 0 (
    echo [OK] MongoDB服务运行正常
) else (
    echo [WARN] MongoDB服务状态异常
)

echo.
echo ====================================
echo 配置完成！
echo ====================================
echo.
echo 配置摘要:
echo   缓存大小: 4 GB
echo   配置文件: %CONFIG_FILE%
echo   备份文件: %BACKUP_FILE%
echo.
echo 下一步操作:
echo   1. 运行验证: node diagnose-mongodb-usage.js
echo   2. 启动应用: npm start
echo.
pause
