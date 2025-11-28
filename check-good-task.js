const { MongoClient } = require('mongodb');

async function checkGoodTask() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 查看之前正确的任务
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251117-gtt' })
        .sort({ period: -1 })
        .toArray();

    console.log('任务 hwc-pos-20251117-gtt 的结果:');
    console.log('总期数:', results.length);

    // 分类统计
    const predicted = results.filter(r => r.is_predicted);
    const drawn = results.filter(r => !r.is_predicted);
    const withHitAnalysis = drawn.filter(r => r.hit_analysis?.max_red_hit > 0 || r.hit_analysis?.total_prize > 0);

    console.log('推算期:', predicted.length);
    console.log('已开奖:', drawn.length);
    console.log('有命中分析的已开奖期:', withHitAnalysis.length);

    console.log('\n=== 已开奖期号详情（前5个）===');
    for (const r of withHitAnalysis.slice(0, 5)) {
        console.log('\n期号:', r.period);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  combination_count:', r.combination_count);
        console.log('  winning_numbers:', JSON.stringify(r.winning_numbers));
        console.log('  hit_analysis:');
        console.log('    max_red_hit:', r.hit_analysis?.max_red_hit);
        console.log('    max_blue_hit:', r.hit_analysis?.max_blue_hit);
        console.log('    hit_rate:', r.hit_analysis?.hit_rate);
        console.log('    total_prize:', r.hit_analysis?.total_prize);
    }

    console.log('\n=== 推算期号详情（如果有）===');
    for (const r of predicted.slice(0, 2)) {
        console.log('\n期号:', r.period);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  combination_count:', r.combination_count);
        console.log('  hit_analysis:', r.hit_analysis ? 'EXISTS' : 'NULL');
    }

    await client.close();
}

checkGoodTask().catch(console.error);
