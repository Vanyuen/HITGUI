const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 查询任务 hwc-pos-20251203-iq9 的所有排除详情
    const details = await db.collection('hit_dlt_exclusiondetails')
        .find({ task_id: 'hwc-pos-20251203-iq9' })
        .toArray();

    console.log('=== 任务排除详情分布 ===');
    const byPeriod = {};
    details.forEach(d => {
        if (!byPeriod[d.period]) byPeriod[d.period] = [];
        byPeriod[d.period].push(d.step);
    });

    Object.keys(byPeriod).sort().forEach(period => {
        console.log('期号:', period, '步骤:', byPeriod[period].sort((a,b)=>a-b).join(', '));
    });

    // 检查是否有推算期25125
    const predicted = await db.collection('hit_dlt_exclusiondetails')
        .countDocuments({ task_id: 'hwc-pos-20251203-iq9', period: '25125' });
    console.log('\n推算期25125记录数:', predicted);

    // 检查各期的结果状态
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251203-iq9' })
        .project({
            period: 1,
            is_predicted: 1,
            has_exclusion_details: 1,
            lightweight_only: 1,
            'hit_analysis.max_red_hit': 1,
            'exclusion_summary': 1
        })
        .sort({ period: 1 })
        .toArray();

    console.log('\n=== 各期结果状态 ===');
    results.forEach(r => {
        const maxHit = r.hit_analysis?.max_red_hit;
        const exSummaryKeys = Object.keys(r.exclusion_summary || {});
        console.log(`期号: ${r.period}, is_predicted: ${r.is_predicted}, has_exclusion_details: ${r.has_exclusion_details}, lightweight: ${r.lightweight_only}, max_red_hit: ${maxHit}, ex_summary: ${exSummaryKeys.length > 0 ? 'YES' : 'NO'}`);
    });

    await mongoose.disconnect();
}

check().catch(e => console.error(e));
