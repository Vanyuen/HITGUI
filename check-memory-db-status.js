const dbManager = require('./src/database/config.js');

async function checkMemoryDbStatus() {
    console.log('🔍 检查当前数据库连接状态\n');

    try {
        // 初始化数据库
        await dbManager.initialize();

        // 获取连接状态
        const status = dbManager.getConnectionStatus();

        console.log('📊 数据库连接信息:');
        console.log('─'.repeat(50));
        console.log(`✓ 连接状态: ${status.isConnected ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`✓ 数据库名: ${status.name}`);
        console.log(`✓ 主机地址: ${status.host}`);
        console.log(`✓ 端口号: ${status.port}`);
        console.log(`✓ Ready状态: ${status.readyState} (1=已连接, 0=断开)`);
        console.log('─'.repeat(50));

        // 判断是否使用内存数据库
        const isMemoryDb = dbManager.mongod !== null;

        if (isMemoryDb) {
            console.log('\n⚠️  当前使用: MongoDB Memory Server (内存数据库)');
            console.log('⚠️  特点:');
            console.log('   - ❌ 数据不持久化（应用关闭后丢失）');
            console.log('   - ✅ 速度快');
            console.log('   - ✅ 无需安装MongoDB');
            console.log('   - 📁 数据库路径:', dbManager.dbPath || '纯内存存储（无文件）');
        } else {
            console.log('\n✅ 当前使用: 本地MongoDB数据库 (持久化存储)');
            console.log('✅ 特点:');
            console.log('   - ✅ 数据持久化（永久保存）');
            console.log('   - ✅ 适合生产环境');
            console.log('   - 📍 连接地址: mongodb://127.0.0.1:27017/lottery');
        }

        // 获取数据库统计信息
        console.log('\n📈 数据库统计信息:');
        console.log('─'.repeat(50));
        const stats = await dbManager.getStats();

        if (stats) {
            console.log(`数据库名称: ${stats.database.name}`);
            console.log(`集合数量: ${stats.database.collections}`);
            console.log(`数据大小: ${(stats.database.dataSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`存储大小: ${(stats.database.storageSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`索引数量: ${stats.database.indexes}`);
            console.log(`索引大小: ${(stats.database.indexSize / 1024 / 1024).toFixed(2)} MB`);

            console.log('\n📋 主要集合记录数:');
            const importantCollections = [
                'hit_dlts',
                'hit_dlt_predictiontasks',
                'PredictionTask',
                'hit_dlt_redcombinations',
                'hit_dlt_bluecombinations'
            ];

            for (const collName of importantCollections) {
                if (stats.collections[collName]) {
                    console.log(`  - ${collName}: ${stats.collections[collName].count} 条记录`);
                }
            }
        }

        console.log('\n─'.repeat(50));

        await dbManager.close();
        console.log('\n✅ 检查完成');
        process.exit(0);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        process.exit(1);
    }
}

checkMemoryDbStatus();
