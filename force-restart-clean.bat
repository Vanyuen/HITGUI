@echo off
echo ========================================
echo 强制清除缓存并重启服务器
echo ========================================
echo.

echo [1/4] 关闭所有Node进程...
taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo    ✓ 已关闭Node进程
) else (
    echo    - 没有运行的Node进程
)
timeout /t 2 /nobreak >nul

echo.
echo [2/4] 关闭所有Electron进程...
taskkill /F /IM electron.exe 2>nul
if %errorlevel% equ 0 (
    echo    ✓ 已关闭Electron进程
) else (
    echo    - 没有运行的Electron进程
)
timeout /t 2 /nobreak >nul

echo.
echo [3/4] 清除Node模块缓存...
if exist "%TEMP%\npm-cache" (
    rd /s /q "%TEMP%\npm-cache" 2>nul
    echo    ✓ 已清除npm缓存
)
if exist "node_modules\.cache" (
    rd /s /q "node_modules\.cache" 2>nul
    echo    ✓ 已清除模块缓存
)
timeout /t 1 /nobreak >nul

echo.
echo [4/4] 重新启动应用...
echo    请手动运行: npm start
echo.
echo ========================================
echo 缓存已清除，请重新启动应用
echo ========================================
pause
