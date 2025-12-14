/**
 * 完整检查所有表的数据一致性
 * 运行: node check-all-consistency.js
 */
const mongoose = require('mongoose');

async function check() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 检查所有表数据一致性（模拟 verifyUnifiedData）');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 获取各表记录数
    const dltCount = await db.collection('hit_dlts').countDocuments();
    const redMissingCount = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    const blueMissingCount = await db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
    const comboFeaturesCount = await db.collection('hit_dlt_combofeatures').countDocuments();
    const hwcOptimizedCount = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').countDocuments();

    // 检查 statistics 字段
    const statisticsCount = await db.collection('hit_dlts').countDocuments({
        'statistics.frontSum': { $exists: true }
    });

    const expectedHWCCount = dltCount; // dltCount - 1 已开奖 + 1 推算期

    console.log('📊 各表记录数对比:\n');
    console.log('┌─────────────────────────────┬──────────┬──────────┬────────┐');
    console.log('│ 数据表                      │ 期望     │ 实际     │ 状态   │');
    console.log('├─────────────────────────────┼──────────┼──────────┼────────┤');

    const checks = [
        { name: 'hit_dlts (主表)', expected: dltCount, actual: dltCount },
        { name: '红球遗漏表', expected: dltCount, actual: redMissingCount },
        { name: '蓝球遗漏表', expected: dltCount, actual: blueMissingCount },
        { name: '组合特征表', expected: dltCount, actual: comboFeaturesCount },
        { name: 'statistics字段', expected: dltCount, actual: statisticsCount },
        { name: '热温冷优化表', expected: expectedHWCCount, actual: hwcOptimizedCount },
    ];

    let allPass = true;
    for (const check of checks) {
        const status = check.expected === check.actual ? '✅' : '❌';
        if (check.expected !== check.actual) allPass = false;
        const diff = check.actual - check.expected;
        const diffStr = diff === 0 ? '' : ` (${diff > 0 ? '+' : ''}${diff})`;
        console.log(`│ ${check.name.padEnd(27)} │ ${String(check.expected).padStart(8)} │ ${String(check.actual).padStart(8)}${diffStr.padEnd(10 - String(check.actual).length)} │ ${status}     │`);
    }

    console.log('└─────────────────────────────┴──────────┴──────────┴────────┘');

    // 详细分析差异
    console.log('\n📋 差异分析:\n');

    // 1. statistics 字段缺失的记录
    if (statisticsCount !== dltCount) {
        const missing = dltCount - statisticsCount;
        console.log(`❌ statistics字段: 缺少 ${missing} 条记录`);

        const recordsWithoutStats = await db.collection('hit_dlts').find({
            $or: [
                { statistics: { $exists: false } },
                { 'statistics.frontSum': { $exists: false } }
            ]
        }).sort({ ID: -1 }).limit(10).project({ ID: 1, Issue: 1 }).toArray();

        console.log('   缺少 statistics 的记录:');
        recordsWithoutStats.forEach(r => {
            console.log(`   - ID: ${r.ID}, Issue: ${r.Issue}`);
        });
    }

    // 2. 热温冷优化表分析
    if (hwcOptimizedCount !== expectedHWCCount) {
        const diff = expectedHWCCount - hwcOptimizedCount;
        console.log(`\n❌ 热温冷优化表: ${diff > 0 ? '缺少' : '多出'} ${Math.abs(diff)} 条记录`);

        // 检查已开奖期和推算期
        const drawnCount = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized')
            .countDocuments({ 'hit_analysis.is_drawn': true });
        const predictedCount = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized')
            .countDocuments({ 'hit_analysis.is_drawn': false });

        console.log(`   - 已开奖期: ${drawnCount} (期望: ${dltCount - 1})`);
        console.log(`   - 推算期: ${predictedCount} (期望: 1)`);
    }

    // 3. 蓝球遗漏表分析
    if (blueMissingCount !== dltCount) {
        const diff = dltCount - blueMissingCount;
        console.log(`\n❌ 蓝球遗漏表: 缺少 ${diff} 条记录`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    if (allPass) {
        console.log('✅ 所有数据表一致性验证通过!');
    } else {
        console.log('❌ 数据不一致，需要修复');
        console.log('\n💡 修复建议:');

        if (statisticsCount !== dltCount) {
            console.log('   1. 运行增量更新 statistics: 点击"一键增量更新"按钮');
        }
        if (hwcOptimizedCount !== expectedHWCCount) {
            console.log('   2. 重建热温冷优化表: 点击"全量重建热温冷优化表"按钮');
        }
        if (blueMissingCount !== dltCount) {
            console.log('   3. 更新蓝球遗漏表: 需要单独处理');
        }
    }

    console.log('═══════════════════════════════════════════════════════════════');

    await mongoose.disconnect();
}

check().catch(err => {
    console.error('❌ 检查失败:', err.message);
    process.exit(1);
});
