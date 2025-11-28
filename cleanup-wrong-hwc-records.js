#!/usr/bin/env node

const mongoose = require('mongoose');

async function cleanupWrongRecords() {
    console.log('\n🧹 清理错误的热温冷优化表记录...\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;
    const hwcTable = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

    console.log('='.repeat(60));
    console.log('步骤1: 查找所有重复记录');
    console.log('='.repeat(60));

    // 查找所有 target_issue，统计重复数
    const pipeline = [
        {
            $group: {
                _id: '$target_issue',
                count: { $sum: 1 },
                records: { $push: { _id: '$_id', base_issue: '$base_issue', generated_at: '$generated_at' } }
            }
        },
        {
            $match: { count: { $gt: 1 } }
        }
    ];

    const duplicates = await hwcTable.aggregate(pipeline).toArray();

    console.log(`\n找到 ${duplicates.length} 个期号有重复记录\n`);

    if (duplicates.length === 0) {
        console.log('✅ 没有重复记录，无需清理');
        await mongoose.disconnect();
        return;
    }

    console.log('='.repeat(60));
    console.log('步骤2: 识别并删除错误记录');
    console.log('='.repeat(60));

    let totalDeleted = 0;

    for (const dup of duplicates) {
        console.log(`\n期号 ${dup._id} 有 ${dup.count} 条记录:`);

        // 获取完整记录
        const records = await hwcTable.find({ target_issue: dup._id }).toArray();

        // 分析每条记录
        const analysis = records.map(record => {
            const ratios = Object.keys(record.hot_warm_cold_data || {});
            const withWarm = ratios.filter(r => {
                const [h, w, c] = r.split(':').map(Number);
                return w > 0;
            });

            return {
                _id: record._id,
                generated_at: record.generated_at,
                ratioCount: ratios.length,
                warmRatioCount: withWarm.length,
                isCorrect: withWarm.length > 0
            };
        });

        // 找出错误记录（无温号的）
        const wrongRecords = analysis.filter(a => !a.isCorrect);
        const correctRecords = analysis.filter(a => a.isCorrect);

        console.log(`  正确记录: ${correctRecords.length} 条（有温号）`);
        console.log(`  错误记录: ${wrongRecords.length} 条（无温号）`);

        if (wrongRecords.length > 0) {
            console.log('\n  准备删除错误记录:');
            wrongRecords.forEach(r => {
                console.log(`    _id: ${r._id}, generated_at: ${r.generated_at}`);
            });

            // 删除错误记录
            const idsToDelete = wrongRecords.map(r => r._id);
            const result = await hwcTable.deleteMany({ _id: { $in: idsToDelete } });

            console.log(`  ✅ 已删除 ${result.deletedCount} 条错误记录`);
            totalDeleted += result.deletedCount;
        }

        // 如果有多条正确记录，保留最新的一条
        if (correctRecords.length > 1) {
            console.log(`\n  ⚠️  有 ${correctRecords.length} 条正确记录，保留最新的一条`);

            // 按生成时间排序，保留最新的
            correctRecords.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
            const toDelete = correctRecords.slice(1); // 删除除最新外的所有记录

            console.log('  准备删除旧的正确记录:');
            toDelete.forEach(r => {
                console.log(`    _id: ${r._id}, generated_at: ${r.generated_at}`);
            });

            const idsToDelete = toDelete.map(r => r._id);
            const result = await hwcTable.deleteMany({ _id: { $in: idsToDelete } });

            console.log(`  ✅ 已删除 ${result.deletedCount} 条旧记录`);
            totalDeleted += result.deletedCount;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('清理完成');
    console.log('='.repeat(60));

    console.log(`\n✅ 总共删除 ${totalDeleted} 条记录`);

    // 验证清理结果
    console.log('\n验证结果:');
    for (const dup of duplicates) {
        const remaining = await hwcTable.countDocuments({ target_issue: dup._id });
        console.log(`  期号 ${dup._id}: 剩余 ${remaining} 条记录`);
    }

    await mongoose.disconnect();
    console.log('\n✅ 清理完成！\n');
}

cleanupWrongRecords().catch(error => {
    console.error('❌ 清理失败:', error);
    process.exit(1);
});
