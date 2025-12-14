/**
 * 创建第一期特殊记录 target_issue=7001
 * 第一期没有基准期，但需要有记录以保持数据完整性
 */
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('✅ 数据库连接成功\n');

    const hwcCol = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const hitDlts = mongoose.connection.db.collection('hit_dlts');
    const redCombos = mongoose.connection.db.collection('hit_dlt_redcombinations');

    // 检查是否已存在
    const existing = await hwcCol.findOne({ target_issue: '7001' });
    if (existing) {
        console.log('✅ target_issue=7001 的记录已存在，无需创建');
        await mongoose.disconnect();
        return;
    }

    // 获取第一期的开奖数据
    const firstIssue = await hitDlts.findOne({ Issue: '7001' });
    if (!firstIssue) {
        console.log('❌ 未找到期号 7001 的开奖数据');
        await mongoose.disconnect();
        return;
    }

    console.log('📊 第一期开奖数据:');
    console.log('  Issue:', firstIssue.Issue, 'ID:', firstIssue.ID);
    console.log('  红球:', firstIssue.Red1, firstIssue.Red2, firstIssue.Red3, firstIssue.Red4, firstIssue.Red5);
    console.log('  蓝球:', firstIssue.Blue1, firstIssue.Blue2);

    // 第一期没有基准期，所有球的遗漏值都是0（视为"热"）
    // 热温冷比: 5:0:0 (所有5个红球都是热号)
    console.log('\n📊 计算热温冷比...');
    console.log('  第一期没有基准期，所有球遗漏值=0，视为"热"');
    console.log('  热温冷比: 5:0:0');

    // 获取所有红球组合
    const allCombos = await redCombos.find({}).project({ combination_id: 1 }).toArray();
    const allComboIds = allCombos.map(c => c.combination_id);
    console.log(`  红球组合总数: ${allComboIds.length}`);

    // 所有组合的热温冷比都是 5:0:0（因为所有球遗漏值都是0）
    const hotWarmColdData = {
        '5:0:0': allComboIds
    };

    const ratioCounts = {
        '5:0:0': allComboIds.length
    };

    // 创建记录
    const newRecord = {
        base_issue: null,           // 第一期没有基准期
        target_issue: '7001',
        base_id: null,              // 第一期没有基准期
        target_id: 1,               // 对应主表 ID=1
        hot_warm_cold_data: hotWarmColdData,
        total_combinations: allComboIds.length,
        hit_analysis: {
            target_winning_reds: [firstIssue.Red1, firstIssue.Red2, firstIssue.Red3, firstIssue.Red4, firstIssue.Red5],
            target_winning_blues: [firstIssue.Blue1, firstIssue.Blue2],
            red_hit_data: {},
            hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
            is_drawn: true
        },
        statistics: { ratio_counts: ratioCounts },
        created_at: new Date()
    };

    await hwcCol.insertOne(newRecord);
    console.log('\n✅ 已创建第一期特殊记录 target_issue=7001');

    // 验证
    const count = await hwcCol.countDocuments();
    console.log(`\n📊 HWC表当前记录数: ${count}`);

    await mongoose.disconnect();
}

main().catch(e => {
    console.error('❌ 错误:', e);
    process.exit(1);
});
