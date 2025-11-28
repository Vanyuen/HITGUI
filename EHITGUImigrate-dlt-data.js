const mongoose = require('mongoose');

async function migrateDLTData() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🔄 大乐透数据迁移脚本\n');

    try {
        // 源集合：hit_dlts
        // 目标集合：HIT_DLT
        const sourceCollection = db.collection('hit_dlts');
        const targetCollection = db.collection('HIT_DLT');

        // 1. 检查源数据
        const sourceCount = await sourceCollection.countDocuments();
        console.log(`📊 源集合 hit_dlts 记录数: ${sourceCount}`);

        if (sourceCount === 0) {
            console.log('❌ 错误：源集合无数据');
            return;
        }

        // 2. 清理目标集合
        await targetCollection.deleteMany({});
        console.log('🧹 已清空目标集合 HIT_DLT');

        // 3. 批量迁移
        const batchSize = 1000;
        let migratedCount = 0;

        const cursor = sourceCollection.find({});

        while (await cursor.hasNext()) {
            const batch = await cursor.limit(batchSize).toArray();

            const transformedBatch = batch.map(doc => ({
                ID: doc.ID,
                Issue: doc.Issue,
                Red1: doc.Red1,
                Red2: doc.Red2,
                Red3: doc.Red3,
                Red4: doc.Red4,
                Red5: doc.Red5,
                Blue1: doc.Blue1,
                Blue2: doc.Blue2,
                DrawDate: doc.DrawDate,
                statistics: doc.statistics,
                FirstPrizeCount: doc.FirstPrizeCount,
                FirstPrizeAmount: doc.FirstPrizeAmount,
                SecondPrizeCount: doc.SecondPrizeCount,
                SecondPrizeAmount: doc.SecondPrizeAmount,
                TotalSales: doc.TotalSales,
                PoolPrize: doc.PoolPrize,
                updatedAt: doc.updatedAt
            }));

            await targetCollection.insertMany(transformedBatch);
            migratedCount += batch.length;

            console.log(`✅ 已迁移 ${migratedCount}/${sourceCount} 条记录`);
        }

        // 4. 创建索引
        await targetCollection.createIndex({ Issue: 1 });
        await targetCollection.createIndex({ ID: 1 });
        console.log('🔍 已为 Issue 和 ID 创建索引');

        // 5. 验证
        const targetCount = await targetCollection.countDocuments();
        console.log(`\n🎉 数据迁移完成！`);
        console.log(`  源集合记录数: ${sourceCount}`);
        console.log(`  目标集合记录数: ${targetCount}`);

        if (targetCount !== sourceCount) {
            console.log('⚠️ 警告：迁移记录数不一致！');
        }

    } catch (error) {
        console.error('❌ 迁移过程中发生错误:', error);
    } finally {
        await mongoose.connection.close();
    }
}

migrateDLTData().catch(console.error);
