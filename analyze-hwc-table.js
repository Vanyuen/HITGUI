const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const hwcTable = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== 热温冷优化表详细分析 ===\n');

    // 1. 总记录数
    const totalCount = await hwcTable.countDocuments();
    console.log('1. 总记录数:', totalCount);

    // 2. 唯一的 target_issue 数量
    const uniqueTargets = await hwcTable.distinct('target_issue');
    console.log('2. 唯一target_issue数量:', uniqueTargets.length);

    // 3. 获取期号范围（按数值排序）
    const sortedTargets = uniqueTargets.map(t => parseInt(t)).sort((a, b) => a - b);
    console.log('3. 期号范围:', sortedTargets[0], '-', sortedTargets[sortedTargets.length - 1]);
    console.log('   最小5期:', sortedTargets.slice(0, 5).join(', '));
    console.log('   最大5期:', sortedTargets.slice(-5).join(', '));

    // 4. 检查期号是否连续
    let gaps = [];
    for (let i = 1; i < sortedTargets.length; i++) {
        if (sortedTargets[i] - sortedTargets[i-1] > 1) {
            gaps.push({ from: sortedTargets[i-1], to: sortedTargets[i], gap: sortedTargets[i] - sortedTargets[i-1] - 1 });
        }
    }
    console.log('4. 期号是否连续:', gaps.length === 0 ? '是' : '否，有' + gaps.length + '个间隙');
    if (gaps.length > 0 && gaps.length <= 10) {
        gaps.forEach(g => console.log('   间隙:', g.from, '->', g.to, '(缺少' + g.gap + '期)'));
    }

    // 5. 检查gfl任务的期号范围覆盖情况
    console.log('\n=== gfl任务期号覆盖分析 ===');
    const gflTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251203-gfl' });

    if (gflTask) {
        console.log('gfl任务期号范围:', gflTask.period_range?.start, '-', gflTask.period_range?.end);

        const gflStart = parseInt(gflTask.period_range?.start || '25017');
        const gflEnd = parseInt(gflTask.period_range?.end || '25125');

        // 检查gfl需要的期号有多少在优化表中
        let coveredCount = 0;
        let missingPeriods = [];
        for (let i = gflStart; i <= gflEnd; i++) {
            if (sortedTargets.includes(i)) {
                coveredCount++;
            } else {
                missingPeriods.push(i);
            }
        }

        const totalNeeded = gflEnd - gflStart + 1;
        console.log('需要的期号数:', totalNeeded);
        console.log('优化表中有的:', coveredCount);
        console.log('缺失的期号数:', missingPeriods.length);
        console.log('覆盖率:', Math.round(coveredCount / totalNeeded * 100) + '%');

        if (missingPeriods.length <= 20) {
            console.log('缺失的期号:', missingPeriods.join(', '));
        } else {
            console.log('缺失的期号(前20个):', missingPeriods.slice(0, 20).join(', ') + '...');
        }
    }

    // 6. 检查优化表数据结构
    console.log('\n=== 优化表数据结构 ===');
    const sample = await hwcTable.findOne({ target_issue: '25124' });
    if (sample) {
        console.log('target_issue 25124 的记录:');
        console.log('  base_issue:', sample.base_issue);
        console.log('  target_issue:', sample.target_issue);
        console.log('  combination_id:', sample.combination_id);
        console.log('  hot_warm_cold_ratio:', sample.hot_warm_cold_ratio);
    } else {
        console.log('target_issue 25124 不存在!');
    }

    // 7. 检查每个target_issue有多少条记录
    console.log('\n=== 每个target_issue的记录数 ===');
    const countByTarget = await hwcTable.aggregate([
        { $group: { _id: '$target_issue', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 10 }
    ]).toArray();
    countByTarget.forEach(c => console.log('  target_issue', c._id, ':', c.count, '条'));

    await mongoose.disconnect();
}

analyze().catch(e => console.error(e));
