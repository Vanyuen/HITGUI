const { MongoClient } = require('mongodb');

async function checkResultsDetail() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 获取任务的所有结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251126-tt6' })
        .sort({ period: -1 })
        .limit(10)
        .toArray();

    console.log('=== 任务 hwc-pos-20251126-tt6 的结果详情 ===');
    console.log('结果数量:', results.length);
    console.log('\n前10条结果:');

    for (const r of results) {
        console.log('\nperiod:', r.period, '| type:', typeof r.period);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  combination_count:', r.combination_count);
        console.log('  winning_numbers:', r.winning_numbers ? JSON.stringify(r.winning_numbers) : 'null');
        console.log('  hit_analysis.max_red_hit:', r.hit_analysis?.max_red_hit);
        console.log('  hit_analysis.total_prize:', r.hit_analysis?.total_prize);
    }

    // 检查期号为字符串的情况
    const result25125 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251126-tt6', period: { $in: ['25125', 25125] } });

    console.log('\n=== 查询period=25125或"25125" ===');
    if (result25125) {
        console.log('找到了! period:', result25125.period, '| type:', typeof result25125.period);
    } else {
        console.log('没有找到');
    }

    // 查看所有不同的period值类型
    const allPeriods = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251126-tt6' })
        .project({ period: 1, is_predicted: 1 })
        .toArray();

    console.log('\n=== 所有period的类型统计 ===');
    const types = {};
    for (const r of allPeriods) {
        const t = typeof r.period;
        types[t] = (types[t] || 0) + 1;
    }
    console.log(types);

    // 找推算期
    const predictedResults = allPeriods.filter(r => r.is_predicted === true);
    console.log('\n推算期结果:', predictedResults.length);
    if (predictedResults.length > 0) {
        console.log('推算期期号:', predictedResults.map(r => r.period).join(', '));
    }

    await client.close();
}

checkResultsDetail().catch(console.error);
