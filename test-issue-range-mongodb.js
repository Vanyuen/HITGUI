const { MongoClient } = require('mongodb');

async function testIssueRange() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 直接使用原生MongoDB查询
    console.log('=== 测试期号范围查询 ===');

    // 1. 检查25120-25124范围内的数据
    const startIssue = '25120';
    const endIssue = '25124';

    const customData = await db.collection('hit_dlts').find({
        Issue: {
            $gte: startIssue,
            $lte: endIssue
        }
    }).sort({ ID: -1 }).toArray();

    console.log(`\n期号 ${startIssue}-${endIssue} 范围内的数据:`, customData.length, '条');
    for (const r of customData) {
        console.log('  Issue:', r.Issue, '| ID:', r.ID);
    }

    // 2. 检查数据库最新期号
    const latestRecord = await db.collection('hit_dlts').find({}).sort({ ID: -1 }).limit(1).toArray();
    console.log('\n最新记录:', latestRecord[0]?.Issue, '| ID:', latestRecord[0]?.ID);

    // 3. 检查数据类型
    console.log('\n数据类型检查:');
    console.log('  Issue类型:', typeof latestRecord[0]?.Issue);
    console.log('  ID类型:', typeof latestRecord[0]?.ID);

    // 4. 验证已有任务结果中的hit_analysis
    const resultsWithHitAnalysis = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ 'hit_analysis.max_red_hit': { $gt: 0 } })
        .limit(3)
        .toArray();

    console.log('\n=== 已有的hit_analysis数据示例 ===');
    for (const r of resultsWithHitAnalysis) {
        console.log('期号:', r.period);
        console.log('  组合数:', r.combination_count);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  max_red_hit:', r.hit_analysis?.max_red_hit);
        console.log('  max_blue_hit:', r.hit_analysis?.max_blue_hit);
        console.log('  hit_rate:', r.hit_analysis?.hit_rate);
        console.log('  total_prize:', r.hit_analysis?.total_prize);
        console.log('  prize_stats:', JSON.stringify(r.hit_analysis?.prize_stats));
        console.log('');
    }

    await client.close();
}

testIssueRange().catch(console.error);
