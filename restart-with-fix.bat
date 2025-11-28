@echo off
echo 🔄 正在彻底重启应用...

echo.
echo ⭐ 步骤1: 强制终止所有进程
TASKKILL /F /IM electron.exe /T >nul 2>&1
TASKKILL /F /IM node.exe /T >nul 2>&1
wmic process where "name='electron.exe'" delete >nul 2>&1
wmic process where "name='node.exe'" delete >nul 2>&1

echo ✅ 步骤1完成

echo.
echo ⭐ 步骤2: 清理Electron缓存和锁文件
rmdir /S /Q "%APPDATA%\hitgui" >nul 2>&1
rmdir /S /Q "%APPDATA%\HIT数据分析系统" >nul 2>&1
rmdir /S /Q "%APPDATA%\Electron" >nul 2>&1
del /F /Q "%TEMP%\*electron*" >nul 2>&1

echo ✅ 步骤2完成

echo.
echo ⭐ 步骤3: 等待5秒让系统释放资源
timeout /t 5 >nul

echo ✅ 步骤3完成

echo.
echo ⭐ 步骤4: 启动应用（包含修复的collection名称）
echo 🌡️ 现在Schema将查询正确的热温冷优化表
echo 📊 预期：所有已开奖期号将有组合数据（不再是0）

npm start

echo.
echo 🎉 应用启动完成！
echo 💡 现在请在应用中创建新的热温冷正选任务测试修复效果
echo.
pause