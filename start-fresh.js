// 启动脚本 - 确保加载最新代码
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 启动 HIT-大乐透 应用（强制清除缓存模式）\n');

// 1. 清除所有可能的require缓存
const serverPath = path.resolve(__dirname, 'src/server/server.js');
const mainPath = path.resolve(__dirname, 'main.js');

console.log('🧹 清理Node.js模块缓存...');
Object.keys(require.cache).forEach(key => {
    if (key.includes('src\\server') || key.includes('src/server')) {
        console.log(`  🗑️  删除缓存: ${path.relative(__dirname, key)}`);
        delete require.cache[key];
    }
});

// 2. 设置环境变量，标记这是强制清除模式
process.env.FORCE_CACHE_CLEAR = 'true';

// 3. 启动Electron
console.log('\n⚡ 启动Electron应用...\n');
const electron = spawn('npx', ['electron', '.'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        FORCE_CACHE_CLEAR: 'true'
    }
});

electron.on('exit', (code) => {
    console.log(`\n📦 应用已退出 (代码: ${code})`);
    process.exit(code);
});

electron.on('error', (err) => {
    console.error('❌ 启动失败:', err);
    process.exit(1);
});
