const mongoose = require('mongoose');

async function diagnoseResults() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 检查任务结果中的 exclusions_to_save 情况
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251202-ge3' })
        .project({
            result_id: 1,
            period: 1,
            is_predicted: 1,
            has_exclusion_details: 1,
            lightweight_only: 1,
            'hit_analysis.max_red_hit': 1
        })
        .sort({ period: 1 })
        .toArray();

    console.log('=== 任务结果分析 ===');
    console.log('总结果数:', results.length);

    // 分析 has_exclusion_details 分布
    const withDetails = results.filter(r => r.has_exclusion_details);
    const withoutDetails = results.filter(r => !r.has_exclusion_details);
    const predicted = results.filter(r => r.is_predicted);
    const withHitAnalysis = results.filter(r => r.hit_analysis?.max_red_hit !== undefined);

    console.log('\n统计:');
    console.log('- has_exclusion_details=true:', withDetails.length);
    console.log('- has_exclusion_details=false:', withoutDetails.length);
    console.log('- is_predicted=true:', predicted.length);
    console.log('- 有hit_analysis数据:', withHitAnalysis.length);

    console.log('\n有排除详情的期号:');
    withDetails.forEach(r => {
        console.log('  ', r.period, '| is_predicted:', r.is_predicted, '| max_red_hit:', r.hit_analysis?.max_red_hit || 'N/A');
    });

    // 检查命中最高的期号
    const sortedByHit = [...results].filter(r => !r.is_predicted && r.hit_analysis?.max_red_hit)
        .sort((a, b) => (b.hit_analysis?.max_red_hit || 0) - (a.hit_analysis?.max_red_hit || 0));

    console.log('\n命中最高的前10期:');
    sortedByHit.slice(0, 10).forEach(r => {
        console.log('  ', r.period, '| max_red_hit:', r.hit_analysis?.max_red_hit, '| has_details:', r.has_exclusion_details);
    });

    await mongoose.disconnect();
}

diagnoseResults().catch(e => console.error(e));
