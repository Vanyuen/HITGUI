const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('=== 检查大乐透历史数据 ===\n');

    // 检查 hit_dlts 表
    const dltCount = await db.collection('hit_dlts').countDocuments();
    console.log('hit_dlts 总记录数:', dltCount);

    if (dltCount > 0) {
        const latestDlt = await db.collection('hit_dlts')
            .find()
            .sort({ Issue: -1 })
            .limit(5)
            .toArray();

        console.log('\n最新5期:');
        latestDlt.forEach(record => {
            console.log(`  期号: ${record.Issue}, 日期: ${record.DrawingDay || 'N/A'}`);
        });

        // 检查是否有25114期
        const issue25114 = await db.collection('hit_dlts')
            .findOne({ Issue: 25114 });

        if (issue25114) {
            console.log('\n✅ 找到期号25114:', issue25114.Issue);
            console.log('   开奖号码:', issue25114.FrontNumbers, '+', issue25114.BackNumbers);
        } else {
            console.log('\n❌ 没有找到期号25114');
        }

        // 检查范围
        const firstIssue = await db.collection('hit_dlts')
            .find()
            .sort({ Issue: 1 })
            .limit(1)
            .toArray();

        console.log(`\n期号范围: ${firstIssue[0].Issue} - ${latestDlt[0].Issue}`);
    }

    // 检查 hit_dlts 表
    const hitDltCount = await db.collection('hit_dlts').countDocuments();
    console.log('\n\nHIT_DLT 总记录数:', hitDltCount);

    await client.close();
})();
