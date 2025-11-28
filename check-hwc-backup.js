/**
 * 检查热温冷比优化表及其备份情况
 */

const mongoose = require('mongoose');

async function checkHWCTables() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 列出所有包含 "hot" 或 "hwc" 或 "warm" 的集合
        const allCollections = await db.listCollections().toArray();
        const hwcRelated = allCollections.filter(c =>
            c.name.toLowerCase().includes('hot') ||
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('warm')
        );

        console.log('📚 所有热温冷相关的集合：');
        for (const coll of hwcRelated) {
            const collection = db.collection(coll.name);
            const count = await collection.countDocuments();
            console.log(`   - ${coll.name}: ${count} 条记录`);
        }

        console.log('\n');

        // 检查主要的热温冷比优化表
        const mainTable = 'HIT_DLT_RedCombinationsHotWarmColdOptimized';
        const mainCollection = db.collection(mainTable);
        const mainCount = await mainCollection.countDocuments();

        console.log(`📊 主表 (${mainTable}): ${mainCount} 条记录`);

        if (mainCount > 0) {
            const drawnCount = await mainCollection.countDocuments({ is_predicted: false });
            const predictedCount = await mainCollection.countDocuments({ is_predicted: true });

            console.log(`   - 已开奖期: ${drawnCount} 条`);
            console.log(`   - 推算期: ${predictedCount} 条`);

            // 获取最早和最新的记录
            const earliest = await mainCollection.findOne({}, { sort: { _id: 1 } });
            const latest = await mainCollection.findOne({}, { sort: { _id: -1 } });

            console.log(`\n   最早记录: ${earliest.base_issue}→${earliest.target_issue}, is_predicted=${earliest.is_predicted}`);
            console.log(`   最新记录: ${latest.base_issue}→${latest.target_issue}, is_predicted=${latest.is_predicted}`);

            // 检查插入时间
            const earliestTime = earliest._id.getTimestamp();
            const latestTime = latest._id.getTimestamp();
            console.log(`\n   最早插入时间: ${earliestTime.toLocaleString('zh-CN')}`);
            console.log(`   最新插入时间: ${latestTime.toLocaleString('zh-CN')}`);
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkHWCTables();
