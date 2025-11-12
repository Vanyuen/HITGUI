// 清除Node.js require缓存并重启服务器
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 开始清理Node.js require缓存...\n');

try {
    // 1. 清除server.js的require缓存
    const serverPath = path.resolve(__dirname, 'src/server/server.js');
    console.log(`📂 目标文件: ${serverPath}`);

    // 查找并删除所有相关缓存
    let cacheCleared = 0;
    Object.keys(require.cache).forEach(key => {
        if (key.includes('server.js') || key.includes('src\\server')) {
            console.log(`  🗑️  删除缓存: ${path.basename(key)}`);
            delete require.cache[key];
            cacheCleared++;
        }
    });

    console.log(`\n✅ 已清除 ${cacheCleared} 个缓存条目\n`);

    // 2. 验证优化代码存在
    const fs = require('fs');
    const content = fs.readFileSync(serverPath, 'utf8');

    const hasOptimizedCode = /class HwcPositivePredictor extends StreamBatchPredictor/.test(content);
    const hasOptimizedLog = /🚀.*开始处理热温冷正选批量预测任务/.test(content);

    console.log('✅ 代码验证:');
    console.log(`  - HwcPositivePredictor类: ${hasOptimizedCode ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  - 优化日志标记: ${hasOptimizedLog ? '✅ 存在' : '❌ 不存在'}`);

    if (!hasOptimizedCode || !hasOptimizedLog) {
        console.error('\n❌ 错误：优化代码在源文件中不存在！');
        process.exit(1);
    }

    console.log('\n✅ 缓存清理完成！');
    console.log('💡 建议：立即重启应用程序，新代码将被加载。\n');

    // 3. 杀死所有进程
    console.log('🔪 正在终止所有electron和node进程...');
    try {
        execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' });
        execSync('taskkill /F /IM node.exe /T 2>nul', { stdio: 'ignore' });
        console.log('✅ 进程已终止\n');
    } catch (e) {
        console.log('⚠️  进程终止可能不完全（可能没有运行中的进程）\n');
    }

    console.log('📝 下一步：请运行 npm start 重启应用');

} catch (error) {
    console.error('❌ 清理失败:', error.message);
    process.exit(1);
}
