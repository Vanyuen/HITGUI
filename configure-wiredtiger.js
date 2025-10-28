/**
 * WiredTiger缓存自动配置脚本
 *
 * 功能: 自动配置MongoDB WiredTiger缓存为4GB
 * 使用: node configure-wiredtiger.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// 查找MongoDB配置文件
function findMongoConfig() {
    const possiblePaths = [
        'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.cfg',
        'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.cfg',
        'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.cfg',
        'C:\\Program Files\\MongoDB\\Server\\5.0\\bin\\mongod.cfg',
        'C:\\Program Files\\MongoDB\\Server\\4.4\\bin\\mongod.cfg',
        'C:\\Program Files\\MongoDB\\Server\\4.2\\bin\\mongod.cfg'
    ];

    for (const configPath of possiblePaths) {
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }

    return null;
}

// 主函数
async function configureWiredTiger() {
    try {
        log('\n====================================', 'cyan');
        log('WiredTiger缓存自动配置 (4GB)', 'bright');
        log('====================================\n', 'cyan');

        // 第1步: 查找配置文件
        log('[1/5] 正在查找MongoDB配置文件...', 'cyan');

        const configFile = findMongoConfig();

        if (!configFile) {
            log('❌ 未找到MongoDB配置文件', 'red');
            log('\n请手动查找mongod.cfg文件路径', 'yellow');
            process.exit(1);
        }

        log(`✅ 找到配置文件: ${configFile}`, 'green');

        // 第2步: 备份配置文件
        log('\n[2/5] 正在备份配置文件...', 'cyan');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const backupFile = `${configFile}.backup_${timestamp}`;

        try {
            fs.copyFileSync(configFile, backupFile);
            log(`✅ 备份成功: ${path.basename(backupFile)}`, 'green');
        } catch (err) {
            log(`❌ 备份失败: ${err.message}`, 'red');
            process.exit(1);
        }

        // 第3步: 读取和修改配置
        log('\n[3/5] 正在修改配置文件...', 'cyan');

        let content = fs.readFileSync(configFile, 'utf8');
        const cacheSize = 4;

        let modified = false;

        // 检查是否已有 cacheSizeGB 配置
        if (/cacheSizeGB\s*:\s*\d+/.test(content)) {
            log('更新现有 cacheSizeGB 配置', 'yellow');
            content = content.replace(/cacheSizeGB\s*:\s*\d+/, `cacheSizeGB: ${cacheSize}`);
            modified = true;
        }
        // 检查是否已有 engineConfig
        else if (/engineConfig:/.test(content)) {
            log('在 engineConfig 中添加 cacheSizeGB', 'yellow');
            content = content.replace(/(engineConfig:)/, `$1\n      cacheSizeGB: ${cacheSize}`);
            modified = true;
        }
        // 检查是否已有 wiredTiger
        else if (/wiredTiger:/.test(content)) {
            log('在 wiredTiger 中添加 engineConfig', 'yellow');
            content = content.replace(/(wiredTiger:)/, `$1\n    engineConfig:\n      cacheSizeGB: ${cacheSize}`);
            modified = true;
        }
        // 检查是否已有 storage
        else if (/storage:/.test(content)) {
            log('在 storage 中添加 wiredTiger 配置', 'yellow');
            content = content.replace(/(storage:)/, `$1\n  wiredTiger:\n    engineConfig:\n      cacheSizeGB: ${cacheSize}`);
            modified = true;
        }
        else {
            log('❌ 无法自动配置', 'red');
            log('\n请手动添加以下配置:', 'yellow');
            log('storage:', 'reset');
            log('  wiredTiger:', 'reset');
            log('    engineConfig:', 'reset');
            log(`      cacheSizeGB: ${cacheSize}`, 'reset');
            process.exit(1);
        }

        if (modified) {
            try {
                fs.writeFileSync(configFile, content, 'utf8');
                log('✅ 配置文件已更新', 'green');
            } catch (err) {
                log(`❌ 保存失败: ${err.message}`, 'red');
                log(`备份文件: ${backupFile}`, 'yellow');
                process.exit(1);
            }
        }

        // 第4步: 重启MongoDB服务
        log('\n[4/5] 正在重启MongoDB服务...', 'cyan');

        try {
            log('  停止MongoDB服务...', 'yellow');
            execSync('net stop MongoDB', { encoding: 'utf8', stdio: 'pipe' });

            log('  等待3秒...', 'yellow');
            await new Promise(resolve => setTimeout(resolve, 3000));

            log('  启动MongoDB服务...', 'yellow');
            execSync('net start MongoDB', { encoding: 'utf8', stdio: 'pipe' });

            log('✅ MongoDB服务已重启', 'green');
        } catch (err) {
            log(`❌ 服务重启失败`, 'red');
            log('可能原因: 配置文件格式错误', 'yellow');
            log(`解决方法: 恢复备份文件 ${backupFile}`, 'yellow');
            log('查看日志: C:\\data\\log\\mongod.log', 'yellow');
            process.exit(1);
        }

        // 第5步: 完成
        log('\n[5/5] 验证配置...', 'cyan');

        try {
            const serviceStatus = execSync('sc query MongoDB', { encoding: 'utf8' });
            if (serviceStatus.includes('RUNNING')) {
                log('✅ MongoDB服务运行正常', 'green');
            } else {
                log('⚠️  MongoDB服务状态异常', 'yellow');
            }
        } catch (err) {
            log('⚠️  无法检查服务状态', 'yellow');
        }

        // 完成总结
        log('\n====================================', 'green');
        log('配置完成！', 'bright');
        log('====================================\n', 'green');

        log('配置摘要:', 'cyan');
        console.log(`  缓存大小: ${cacheSize} GB`);
        console.log(`  配置文件: ${configFile}`);
        console.log(`  备份文件: ${backupFile}`);
        console.log('');

        log('预期效果:', 'cyan');
        log('  ✅ MongoDB内存占用: 9.2GB → 约3.6GB', 'green');
        log('  ✅ 释放内存: 约5.6GB', 'green');
        log('  ✅ 批量预测性能: 保持不变或略微下降(<5%)', 'green');
        console.log('');

        log('下一步操作:', 'cyan');
        log('  1. 运行诊断: node diagnose-mongodb-usage.js', 'yellow');
        log('  2. 启动应用: npm start', 'yellow');
        console.log('');

    } catch (error) {
        log(`\n❌ 错误: ${error.message}`, 'red');
        console.error(error.stack);
        process.exit(1);
    }
}

// 执行配置
configureWiredTiger();
