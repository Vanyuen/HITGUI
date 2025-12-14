const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 检查gfl任务各期的组合数量
    console.log('=== gfl任务各期组合数量 ===');
    const gflResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251203-gfl' })
        .project({ period: 1, combination_count: 1, is_predicted: 1, 'hit_analysis.max_red_hit': 1 })
        .sort({ period: -1 })
        .limit(20)
        .toArray();

    for (const r of gflResults) {
        console.log(`期号: ${r.period}, 组合数: ${r.combination_count}, is_predicted: ${r.is_predicted}, max_red_hit: ${r.hit_analysis?.max_red_hit}`);
    }

    // 统计
    const stats = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .aggregate([
            { $match: { task_id: 'hwc-pos-20251203-gfl' } },
            { $group: {
                _id: null,
                total: { $sum: 1 },
                with_combinations: { $sum: { $cond: [{ $gt: ['$combination_count', 0] }, 1, 0] } },
                zero_combinations: { $sum: { $cond: [{ $eq: ['$combination_count', 0] }, 1, 0] } },
                with_hits: { $sum: { $cond: [{ $gt: ['$hit_analysis.max_red_hit', 0] }, 1, 0] } }
            }}
        ]).toArray();

    console.log('\n=== 统计 ===');
    console.log('总期数:', stats[0]?.total);
    console.log('有组合的期数:', stats[0]?.with_combinations);
    console.log('组合数为0的期数:', stats[0]?.zero_combinations);
    console.log('有命中的期数:', stats[0]?.with_hits);

    // 对比lmz任务
    console.log('\n=== lmz任务各期组合数量 ===');
    const lmzResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251203-lmz' })
        .project({ period: 1, combination_count: 1, is_predicted: 1, 'hit_analysis.max_red_hit': 1 })
        .sort({ period: -1 })
        .toArray();

    for (const r of lmzResults) {
        console.log(`期号: ${r.period}, 组合数: ${r.combination_count}, is_predicted: ${r.is_predicted}, max_red_hit: ${r.hit_analysis?.max_red_hit}`);
    }

    await mongoose.disconnect();
}

analyze().catch(e => console.error(e));
