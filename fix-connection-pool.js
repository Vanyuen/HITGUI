/**
 * 修复连接池配置脚本
 *
 * 自动修改 src/database/config.js 以优化MongoDB连接池配置
 *
 * 使用方法: node fix-connection-pool.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'src', 'database', 'config.js');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fixConnectionPool() {
    try {
        log('\n🔧 修复MongoDB连接池配置\n', 'bright');

        // 检查文件是否存在
        if (!fs.existsSync(CONFIG_FILE)) {
            log(`❌ 错误: 配置文件不存在: ${CONFIG_FILE}`, 'red');
            process.exit(1);
        }

        log(`📂 读取配置文件: ${CONFIG_FILE}`, 'cyan');

        // 读取原文件内容
        let content = fs.readFileSync(CONFIG_FILE, 'utf8');

        // 备份原文件
        const backupFile = CONFIG_FILE + '.backup_' + Date.now();
        fs.writeFileSync(backupFile, content);
        log(`✅ 已创建备份: ${path.basename(backupFile)}`, 'green');

        // 查找mongoose.connect调用
        const connectPattern = /mongoose\.connect\([^)]+\)/g;
        const matches = content.match(connectPattern);

        if (!matches || matches.length === 0) {
            log('⚠️  警告: 未找到 mongoose.connect 调用', 'yellow');
            log('   请手动检查配置文件\n', 'yellow');
            return;
        }

        log(`\n🔍 找到 ${matches.length} 个 mongoose.connect 调用\n`, 'cyan');

        // 替换连接配置
        let modified = false;

        for (const match of matches) {
            log('原配置:', 'yellow');
            console.log(`  ${match}\n`);

            // 检查是否已有配置对象
            if (match.includes('{')) {
                // 已有配置对象，检查是否有连接池配置
                if (match.includes('maxPoolSize')) {
                    log('  ⏭️  已有连接池配置，跳过\n', 'yellow');
                    continue;
                }

                // 添加连接池配置到现有对象
                const newMatch = match.replace(/\{/, `{
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    `);

                content = content.replace(match, newMatch);
                modified = true;

                log('新配置:', 'green');
                console.log(`  ${newMatch}\n`);
            } else {
                // 没有配置对象，添加完整配置
                const uri = match.match(/mongoose\.connect\(([^,)]+)/)[1];
                const newMatch = `mongoose.connect(${uri}, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
})`;

                content = content.replace(match, newMatch);
                modified = true;

                log('新配置:', 'green');
                console.log(`  ${newMatch}\n`);
            }
        }

        if (modified) {
            // 写入修改后的内容
            fs.writeFileSync(CONFIG_FILE, content);
            log('✅ 配置文件已更新', 'green');
            log(`📁 原文件备份: ${path.basename(backupFile)}\n`, 'cyan');

            log('📋 连接池配置说明:', 'bright');
            console.log('  maxPoolSize: 10        - 最大连接数限制为10');
            console.log('  minPoolSize: 2         - 最小保持2个连接');
            console.log('  serverSelectionTimeoutMS: 5000 - 服务器选择超时5秒');
            console.log('  socketTimeoutMS: 45000 - Socket超时45秒');
            console.log('  family: 4              - 强制使用IPv4\n');

            log('🎯 下一步操作:', 'bright');
            log('  1. 重启应用以使配置生效', 'yellow');
            log('  2. 运行 node diagnose-mongodb-usage.js 验证连接数\n', 'yellow');

            log('✅ 预期效果:', 'green');
            log('  连接数从 300+ 降至 10-20\n', 'green');
        } else {
            log('ℹ️  无需修改，配置已是最优\n', 'cyan');
        }

        log('🎉 配置修复完成！\n', 'bright');

    } catch (error) {
        log(`\n❌ 错误: ${error.message}`, 'red');
        console.error(error.stack);
        process.exit(1);
    }
}

// 执行修复
fixConnectionPool();
