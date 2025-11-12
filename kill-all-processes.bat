@echo off
echo ========================================
echo 强制终止所有 Electron 和 Node 进程
echo ========================================
echo.

echo 正在终止 electron.exe 进程...
taskkill /F /IM electron.exe /T 2>nul
if %errorlevel% equ 0 (
    echo [成功] electron.exe 已终止
) else (
    echo [信息] 未找到 electron.exe 进程
)

echo.
echo 正在终止 node.exe 进程...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo [成功] node.exe 已终止
) else (
    echo [警告] 无法终止 node.exe（可能需要管理员权限）
)

echo.
echo 等待 3 秒...
timeout /t 3 /nobreak >nul

echo.
echo 检查剩余进程...
tasklist | findstr /i "electron node" >nul
if %errorlevel% equ 0 (
    echo [警告] 仍有进程在运行:
    tasklist | findstr /i "electron node"
    echo.
    echo 请右键点击此文件，选择"以管理员身份运行"
) else (
    echo [成功] 所有进程已终止
)

echo.
echo ========================================
pause
