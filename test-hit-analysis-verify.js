const { MongoClient } = require('mongodb');

async function check() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 查找25xxx期号
    const records25 = await db.collection('hit_dlts').find({ Issue: { $regex: '^25' } }).sort({ Issue: -1 }).limit(5).toArray();
    console.log('Latest 25xxx records:');
    for (const r of records25) {
        console.log('Issue:', r.Issue, '| Red:', r.RedBalls?.join(','), '| Blue:', r.BlueBalls?.join(','));
    }

    // 查看25124期号
    const r25124 = await db.collection('hit_dlts').findOne({ Issue: '25124' });
    console.log('\nRecord 25124:', r25124 ? 'EXISTS' : 'NOT FOUND');
    if (r25124) {
        console.log('  RedBalls:', r25124.RedBalls);
        console.log('  BlueBalls:', r25124.BlueBalls);
    }

    // 查看有hit_analysis且is_predicted=false的结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').find({
        is_predicted: false,
        combination_count: { $gt: 0 }
    }).limit(3).toArray();
    console.log('\n=== Results with is_predicted=false and combinations > 0 ===');
    for (const r of results) {
        console.log('period:', r.period, '| combinations:', r.combination_count);
        if (r.hit_analysis) {
            console.log('  max_red_hit:', r.hit_analysis.max_red_hit, '| max_blue_hit:', r.hit_analysis.max_blue_hit);
            console.log('  total_prize:', r.hit_analysis.total_prize, '| hit_rate:', r.hit_analysis.hit_rate);
            console.log('  prize_stats:', JSON.stringify(r.hit_analysis.prize_stats));
        }
    }

    // 查看is_predicted=true的结果
    const predictedResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').find({
        is_predicted: true
    }).limit(3).toArray();
    console.log('\n=== Results with is_predicted=true ===');
    for (const r of predictedResults) {
        console.log('period:', r.period, '| combinations:', r.combination_count);
        console.log('  hit_analysis:', r.hit_analysis ? 'EXISTS' : 'NULL');
    }

    await client.close();
}

check().catch(console.error);
