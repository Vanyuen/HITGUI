/**
 * MongoDB优化脚本
 *
 * 执行以下优化:
 * 1. 删除冗余索引 (释放约15 MB)
 * 2. 优化排除详情表索引 (释放约1.5 GB)
 * 3. 验证连接池配置
 * 4. 输出WiredTiger配置建议
 *
 * 使用方法: node optimize-mongodb.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function optimizeMongoDB() {
    try {
        log('\n🚀 MongoDB优化脚本启动\n', 'bright');

        // 连接数据库
        log('📡 正在连接MongoDB...', 'cyan');
        await mongoose.connect(MONGODB_URI);
        log('✅ MongoDB连接成功\n', 'green');

        const db = mongoose.connection.db;

        // ==================== 第1步: 删除冗余索引 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📋 第1步: 删除 hit_dlt_redcombinations 的冗余索引', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        const redCombosCollection = db.collection('hit_dlt_redcombinations');

        // 获取当前所有索引
        const existingIndexes = await redCombosCollection.indexes();
        log('当前索引列表:', 'cyan');
        existingIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        console.log('');

        // 要删除的冗余索引列表
        const redundantIndexes = [
            'sum_1',              // 保留 sum_value_1
            'sumRange_1',         // 保留 sum_value_1
            'zoneRatio_1',        // 保留 zone_ratio_1
            'evenOddRatio_1',     // 保留 odd_even_ratio_1
            'consecutiveCount_1', // 冗余
            'consecutive_groups_1', // 冗余
            'max_consecutive_length_1' // 冗余
        ];

        let deletedCount = 0;
        let skippedCount = 0;

        for (const indexName of redundantIndexes) {
            try {
                const indexExists = existingIndexes.some(idx => idx.name === indexName);

                if (!indexExists) {
                    log(`  ⏭️  索引 ${indexName} 不存在，跳过`, 'yellow');
                    skippedCount++;
                    continue;
                }

                log(`  🗑️  正在删除索引: ${indexName}...`, 'cyan');
                await redCombosCollection.dropIndex(indexName);
                log(`  ✅ 成功删除索引: ${indexName}`, 'green');
                deletedCount++;
            } catch (err) {
                if (err.code === 27 || err.message.includes('not found')) {
                    log(`  ⏭️  索引 ${indexName} 不存在，跳过`, 'yellow');
                    skippedCount++;
                } else {
                    log(`  ❌ 删除索引 ${indexName} 失败: ${err.message}`, 'red');
                }
            }
        }

        log(`\n📊 索引删除汇总:`, 'bright');
        log(`  ✅ 成功删除: ${deletedCount} 个`, 'green');
        log(`  ⏭️  跳过: ${skippedCount} 个`, 'yellow');
        log(`  💾 预计释放空间: ~${deletedCount * 2} MB\n`, 'cyan');

        // ==================== 第2步: 优化排除详情表索引 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📋 第2步: 优化 hit_dlt_exclusiondetails 索引', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        const exclusionDetailsCollection = db.collection('hit_dlt_exclusiondetails');

        // 获取当前所有索引
        const exclusionIndexes = await exclusionDetailsCollection.indexes();
        log('当前索引列表:', 'cyan');
        exclusionIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        console.log('');

        // 要删除的不常用条件字段索引
        const unusedConditionIndexes = [
            'sum_condition_1',
            'span_condition_1',
            'zone_ratio_condition_1',
            'odd_even_ratio_condition_1',
            'hot_warm_cold_condition_1'
        ];

        let exclusionDeletedCount = 0;
        let exclusionSkippedCount = 0;

        for (const indexName of unusedConditionIndexes) {
            try {
                const indexExists = exclusionIndexes.some(idx => idx.name === indexName);

                if (!indexExists) {
                    log(`  ⏭️  索引 ${indexName} 不存在，跳过`, 'yellow');
                    exclusionSkippedCount++;
                    continue;
                }

                log(`  🗑️  正在删除索引: ${indexName}...`, 'cyan');
                await exclusionDetailsCollection.dropIndex(indexName);
                log(`  ✅ 成功删除索引: ${indexName}`, 'green');
                exclusionDeletedCount++;
            } catch (err) {
                if (err.code === 27 || err.message.includes('not found')) {
                    log(`  ⏭️  索引 ${indexName} 不存在，跳过`, 'yellow');
                    exclusionSkippedCount++;
                } else {
                    log(`  ❌ 删除索引 ${indexName} 失败: ${err.message}`, 'red');
                }
            }
        }

        log(`\n📊 索引删除汇总:`, 'bright');
        log(`  ✅ 成功删除: ${exclusionDeletedCount} 个`, 'green');
        log(`  ⏭️  跳过: ${exclusionSkippedCount} 个`, 'yellow');
        log(`  💾 预计释放空间: ~${(exclusionDeletedCount * 300).toFixed(0)} MB\n`, 'cyan');

        // ==================== 第3步: 检查连接池配置 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📋 第3步: 检查连接池配置', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        const serverStatus = await db.admin().command({ serverStatus: 1 });
        log('当前连接状态:', 'cyan');
        console.log(`  当前连接数: ${serverStatus.connections.current}`);
        console.log(`  可用连接数: ${serverStatus.connections.available}`);
        console.log(`  总创建连接数: ${serverStatus.connections.totalCreated}`);
        console.log('');

        if (serverStatus.connections.current > 50) {
            log('⚠️  警告: 当前连接数过高 (>50)', 'yellow');
            log('   建议修改 src/database/config.js 配置连接池\n', 'yellow');
        } else {
            log('✅ 连接数正常\n', 'green');
        }

        // ==================== 第4步: MongoDB配置建议 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📋 第4步: WiredTiger缓存配置建议', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        log('当前WiredTiger缓存配置:', 'cyan');
        if (serverStatus.wiredTiger) {
            const currentCache = (serverStatus.wiredTiger.cache['bytes currently in the cache'] / 1024 / 1024).toFixed(2);
            const maxCache = (serverStatus.wiredTiger.cache['maximum bytes configured'] / 1024 / 1024).toFixed(2);
            console.log(`  当前使用: ${currentCache} MB`);
            console.log(`  最大限制: ${maxCache} MB`);
            console.log('');

            if (maxCache > 5000) {
                log('⚠️  建议: 限制WiredTiger缓存为4GB', 'yellow');
                log('   当前最大缓存过高，可能导致内存占用过大\n', 'yellow');
            } else {
                log('✅ 缓存配置合理\n', 'green');
            }
        }

        log('手动配置步骤:', 'cyan');
        log('1. 找到MongoDB配置文件 mongod.cfg', 'yellow');
        log('   通常位于: C:\\Program Files\\MongoDB\\Server\\<version>\\bin\\mongod.cfg\n', 'yellow');

        log('2. 编辑配置文件，添加或修改:', 'yellow');
        console.log(`
${colors.green}storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4${colors.reset}
`);

        log('3. 重启MongoDB服务:', 'yellow');
        log('   net stop MongoDB', 'cyan');
        log('   net start MongoDB\n', 'cyan');

        // ==================== 优化后统计 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📊 优化完成统计', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        const totalIndexesDeleted = deletedCount + exclusionDeletedCount;
        const estimatedSpaceSaved = (deletedCount * 2) + (exclusionDeletedCount * 300);

        log('优化结果:', 'green');
        console.log(`  ✅ 总共删除索引: ${totalIndexesDeleted} 个`);
        console.log(`  💾 预计释放空间: ~${estimatedSpaceSaved} MB`);
        console.log(`  🔗 连接池状态: ${serverStatus.connections.current <= 50 ? '正常' : '需要配置'}`);
        console.log(`  📦 WiredTiger缓存: ${serverStatus.wiredTiger && serverStatus.wiredTiger.cache['maximum bytes configured'] / 1024 / 1024 / 1024 <= 5 ? '已优化' : '需要手动配置'}`);
        console.log('');

        // ==================== 下一步建议 ====================
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('🎯 下一步操作', 'bright');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

        log('需要手动完成的操作:', 'yellow');
        console.log('');

        if (serverStatus.connections.current > 50) {
            log('1. 修复连接池配置:', 'yellow');
            log('   编辑文件: src/database/config.js', 'cyan');
            log('   运行命令: node fix-connection-pool.js\n', 'cyan');
        }

        if (!serverStatus.wiredTiger || serverStatus.wiredTiger.cache['maximum bytes configured'] / 1024 / 1024 / 1024 > 5) {
            log('2. 配置WiredTiger缓存限制:', 'yellow');
            log('   编辑文件: mongod.cfg', 'cyan');
            log('   重启MongoDB服务\n', 'cyan');
        }

        log('3. 验证优化效果:', 'yellow');
        log('   运行命令: node diagnose-mongodb-usage.js\n', 'cyan');

        await mongoose.disconnect();
        log('✅ 数据库连接已关闭', 'green');
        log('\n🎉 优化脚本执行完成！\n', 'bright');

    } catch (error) {
        log(`\n❌ 错误: ${error.message}`, 'red');
        console.error(error.stack);
        process.exit(1);
    }
}

// 执行优化
optimizeMongoDB();
