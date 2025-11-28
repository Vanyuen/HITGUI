const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function diagnoseMongoDBConnection() {
    const client = new MongoClient(MONGODB_URI);

    try {
        console.log('🔍 开始MongoDB连接诊断...\n');

        // 1. 基本连接测试
        await client.connect();
        console.log('✅ 成功连接到MongoDB\n');

        const db = client.db(DB_NAME);

        // 2. 列出所有集合
        const collections = await db.listCollections().toArray();
        console.log('📊 数据库集合列表:');
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });
        console.log('');

        // 3. 检查 hit_dlts 集合
        const Hit_dlts = db.collection('hit_dlts');
        const dltsCount = await Hit_dlts.countDocuments();
        console.log('🔎 hit_dlts 集合诊断:');
        console.log(`   - 总记录数: ${dltsCount}`);

        const latestIssue = await Hit_dlts.findOne({}, { sort: { ID: -1 } });
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 最新期ID: ${latestIssue.ID}\n`);

        // 4. 检查 hit_dlt_redcombinationshotwarmcoldoptimizeds 集合
        const HWCOptimized = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const hwcCount = await HWCOptimized.countDocuments();
        console.log('🔬 热温冷比优化表诊断:');
        console.log(`   - 总记录数: ${hwcCount}\n`);

        // 5. 检查权限和写入能力
        console.log('🔒 权限测试:');
        try {
            const testDoc = { test: 'write_test', timestamp: new Date() };
            const insertResult = await HWCOptimized.insertOne(testDoc);
            console.log('   - 写入测试: 成功 ✅');
            await HWCOptimized.deleteOne({ _id: insertResult.insertedId });
            console.log('   - 删除测试: 成功 ✅\n');
        } catch (writeError) {
            console.error('   - 写入测试: 失败 ❌');
            console.error(`   错误详情: ${writeError.message}\n`);
        }

        // 6. 检查索引
        const indexes = await HWCOptimized.indexes();
        console.log('🔑 集合索引:');
        indexes.forEach(index => {
            console.log(`   - ${JSON.stringify(index.key)}`);
        });

        // 7. 记录诊断日志
        const logContent = {
            timestamp: new Date().toISOString(),
            dltsCount,
            latestIssue: latestIssue.Issue,
            hwcCount,
            collectionNames: collections.map(c => c.name)
        };

        const logPath = path.join(__dirname, 'mongodb_diagnostics_log.json');
        fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2));
        console.log(`\n📝 诊断日志已保存到: ${logPath}`);

        await client.close();
    } catch (error) {
        console.error('❌ 诊断过程中出现严重错误:', error.message);
        console.error(error.stack);
    }
}

diagnoseMongoDBConnection();