const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnoseMongoDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        const db = mongoose.connection.db;

        // 1. 获取数据库统计信息
        console.log('📊 数据库整体统计:');
        const dbStats = await db.stats();
        console.log(`  总大小: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  索引大小: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  存储大小: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  集合数: ${dbStats.collections}`);
        console.log(`  索引数: ${dbStats.indexes}\n`);

        // 2. 获取所有集合信息
        const collections = await db.listCollections().toArray();
        console.log('📦 集合详细信息 (按大小排序):\n');

        const collectionStats = [];
        for (const coll of collections) {
            const stats = await db.collection(coll.name).stats();
            const indexes = await db.collection(coll.name).indexes();

            collectionStats.push({
                name: coll.name,
                size: stats.size,
                storageSize: stats.storageSize,
                indexSize: stats.totalIndexSize || 0,
                count: stats.count,
                avgObjSize: stats.avgObjSize || 0,
                indexCount: indexes.length
            });
        }

        // 按存储大小排序
        collectionStats.sort((a, b) => b.storageSize - a.storageSize);

        // 显示前20个最大的集合
        console.log('🔝 存储占用最大的集合:\n');
        for (let i = 0; i < Math.min(20, collectionStats.length); i++) {
            const s = collectionStats[i];
            console.log(`${i + 1}. ${s.name}`);
            console.log(`   数据大小: ${(s.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   存储大小: ${(s.storageSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   索引大小: ${(s.indexSize / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   文档数: ${s.count.toLocaleString()}`);
            console.log(`   平均文档大小: ${(s.avgObjSize).toFixed(0)} bytes`);
            console.log(`   索引数: ${s.indexCount}`);
            console.log('');
        }

        // 3. 检查正在运行的操作
        console.log('⚙️ 当前运行的操作:\n');
        const currentOps = await db.admin().command({ currentOp: true });
        const activeOps = currentOps.inprog.filter(op =>
            op.op !== 'none' &&
            !op.desc?.includes('conn') &&
            op.active === true
        );

        if (activeOps.length > 0) {
            console.log(`发现 ${activeOps.length} 个活动操作:\n`);
            activeOps.forEach((op, i) => {
                console.log(`${i + 1}. ${op.op} on ${op.ns}`);
                console.log(`   运行时间: ${op.secs_running}秒`);
                console.log(`   查询: ${JSON.stringify(op.command).substring(0, 100)}...`);
                console.log('');
            });
        } else {
            console.log('✅ 没有长时间运行的操作\n');
        }

        // 4. 检查索引效率
        console.log('🔍 索引效率分析:\n');
        const largeCollections = collectionStats.filter(c => c.count > 100000);

        for (const coll of largeCollections) {
            const indexes = await db.collection(coll.name).indexes();
            console.log(`${coll.name} (${coll.count.toLocaleString()} 文档):`);
            indexes.forEach(idx => {
                const indexSizeMB = (coll.indexSize / indexes.length / 1024 / 1024).toFixed(2);
                console.log(`  - ${JSON.stringify(idx.key)}: ${indexSizeMB} MB`);
            });
            console.log('');
        }

        // 5. 检查连接数
        console.log('🔗 连接统计:\n');
        const serverStatus = await db.admin().command({ serverStatus: 1 });
        console.log(`  当前连接数: ${serverStatus.connections.current}`);
        console.log(`  可用连接数: ${serverStatus.connections.available}`);
        console.log(`  总创建连接数: ${serverStatus.connections.totalCreated}\n`);

        // 6. 内存使用
        console.log('💾 内存使用:\n');
        console.log(`  常驻内存: ${(serverStatus.mem.resident)} MB`);
        console.log(`  虚拟内存: ${(serverStatus.mem.virtual)} MB`);
        if (serverStatus.wiredTiger) {
            console.log(`  WiredTiger缓存: ${(serverStatus.wiredTiger.cache['bytes currently in the cache'] / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  WiredTiger最大缓存: ${(serverStatus.wiredTiger.cache['maximum bytes configured'] / 1024 / 1024).toFixed(2)} MB`);
        }

        await mongoose.disconnect();
        console.log('\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnoseMongoDB();
