/**
 * 检查热温冷优化表的数据
 */
const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const hwcCollection = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 统计总数
        const totalCount = await hwcCollection.countDocuments();
        console.log('热温冷优化表总记录数:', totalCount);

        // 检查最新的target_issue
        const latestRecords = await hwcCollection.find({})
            .sort({ target_id: -1 })
            .limit(5)
            .toArray();

        console.log('\n最新5条记录:');
        for (const r of latestRecords) {
            console.log(`  base_id: ${r.base_id}, target_id: ${r.target_id}`);
        }

        // 检查是否有25140, 25141, 25142相关数据
        for (const targetId of [25140, 25141, 25142, 2808, 2809, 2810]) {
            const count = await hwcCollection.countDocuments({ target_id: targetId });
            console.log(`\ntarget_id=${targetId} 的记录数: ${count}`);
        }

        // 检查target_id的范围
        const stats = await hwcCollection.aggregate([
            { $group: {
                _id: null,
                minTargetId: { $min: '$target_id' },
                maxTargetId: { $max: '$target_id' }
            }}
        ]).toArray();

        if (stats.length > 0) {
            console.log('\ntarget_id 范围:', stats[0].minTargetId, '-', stats[0].maxTargetId);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ 错误:', err.message);
        process.exit(1);
    }
}

check();
