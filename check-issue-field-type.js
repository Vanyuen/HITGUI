const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('检查 hit_dlts 表 Issue 字段类型...\n');

    const sample = await db.collection('hit_dlts').findOne({}, { projection: { Issue: 1 } });
    console.log('示例记录:');
    console.log('  Issue:', sample.Issue);
    console.log('  Issue类型:', typeof sample.Issue);

    const sorted = await db.collection('hit_dlts')
        .find({}, { projection: { Issue: 1 } })
        .sort({ Issue: -1 })
        .limit(5)
        .toArray();

    console.log('\n按Issue降序排列的前5期:');
    sorted.forEach(r => {
        console.log(`  Issue: ${r.Issue} (类型: ${typeof r.Issue})`);
    });

    const sorted2 = await db.collection('hit_dlts')
        .find({}, { projection: { Issue: 1 } })
        .sort({ Issue: 1 })
        .limit(5)
        .toArray();

    console.log('\n按Issue升序排列的前5期:');
    sorted2.forEach(r => {
        console.log(`  Issue: ${r.Issue} (类型: ${typeof r.Issue})`);
    });

    await client.close();
})();
