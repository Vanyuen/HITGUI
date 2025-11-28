const { MongoClient } = require('mongodb');

async function check() {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017/lottery');
    const db = client.db('lottery');

    // 查看hit_dlts集合的字段结构
    const sample = await db.collection('hit_dlts').findOne({ Issue: '25124' });
    console.log('=== hit_dlts record 25124 full structure ===');
    console.log(JSON.stringify(sample, null, 2));

    // 查看另一条记录来确认字段名
    const sample2 = await db.collection('hit_dlts').findOne({ Issue: '25120' });
    console.log('\n=== hit_dlts record 25120 full structure ===');
    console.log(JSON.stringify(sample2, null, 2));

    // 检查一等奖二等奖的金额数据
    const recordWithPrize = await db.collection('hit_dlts').findOne({
        Issue: '25123'
    });
    console.log('\n=== 25123 prize info ===');
    console.log('First prize (一等奖):', recordWithPrize?.FirstPrize || recordWithPrize?.first_prize);
    console.log('Second prize (二等奖):', recordWithPrize?.SecondPrize || recordWithPrize?.second_prize);
    console.log('All keys:', Object.keys(recordWithPrize || {}));

    await client.close();
}

check().catch(console.error);
