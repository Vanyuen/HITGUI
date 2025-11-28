/**
 * 检查 hit_dlt_redcombinationshotwarmcoldoptimizeds 表的详细信息
 */

const mongoose = require('mongoose');

async function checkAlternativeTable() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        const count = await collection.countDocuments();
        console.log(`📊 hit_dlt_redcombinationshotwarmcoldoptimizeds 表记录数: ${count}\n`);

        // 获取样本记录
        const sample = await collection.findOne({});
        console.log('📋 样本记录结构:');
        console.log(`   字段: ${Object.keys(sample).join(', ')}\n`);

        console.log('📋 样本记录详情:');
        console.log(JSON.stringify(sample, null, 2).substring(0, 1000));

        // 检查是否有 is_predicted 字段
        const hasPredicted = await collection.countDocuments({ is_predicted: { $exists: true } });
        console.log(`\n\n📊 统计信息:`);
        console.log(`   有 is_predicted 字段: ${hasPredicted} / ${count}`);

        if (hasPredicted > 0) {
            const drawnCount = await collection.countDocuments({ is_predicted: false });
            const predictedCount = await collection.countDocuments({ is_predicted: true });
            console.log(`   已开奖期: ${drawnCount}`);
            console.log(`   推算期: ${predictedCount}`);
        }

        // 检查最早和最新记录
        const earliest = await collection.findOne({}, { sort: { _id: 1 } });
        const latest = await collection.findOne({}, { sort: { _id: -1 } });

        console.log(`\n📅 时间范围:`);
        console.log(`   最早插入: ${earliest._id.getTimestamp().toLocaleString('zh-CN')}`);
        console.log(`   最新插入: ${latest._id.getTimestamp().toLocaleString('zh-CN')}`);

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkAlternativeTable();
