const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    const count = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    console.log('=== 遗漏数据表统计 ===');
    console.log('总记录数:', count);

    if (count === 0) {
        console.log('❌ 遗漏数据表为空！');
        await client.close();
        return;
    }

    const latest = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').find().sort({Issue: -1}).limit(5).toArray();
    console.log('最新5期:', latest.map(d => d.Issue));

    const missing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').findOne({ Issue: "25114" });

    if (!missing) {
        console.log('\n⚠️ 期号25114没有遗漏数据');
        console.log('使用最新一期:', latest[0].Issue);
        const sample = latest[0];

        console.log('\n=== 字段检查 ===');
        const ballFields = Object.keys(sample).filter(k => !k.startsWith('_') && k !== 'Issue');
        console.log('球号字段数量:', ballFields.length);
        console.log('前10个字段:', ballFields.slice(0, 10));

        console.log('\n=== 字段值示例 ===');
        ballFields.slice(0, 5).forEach(field => {
            console.log(`${field}:`, sample[field]);
        });

        await client.close();
        return;
    }

    console.log('\n=== 期号25114遗漏数据检查 ===');
    const ballFields = Object.keys(missing).filter(k => !k.startsWith('_') && k !== 'Issue');
    console.log('球号字段数量:', ballFields.length);
    console.log('前10个字段:', ballFields.slice(0, 10));

    console.log('\n=== 测试不同字段名格式 ===');
    console.log('missing["1"]:', missing['1']);
    console.log('missing["01"]:', missing['01']);
    console.log('missing.Red1:', missing.Red1);

    console.log('\n=== 字段值示例 ===');
    ballFields.slice(0, 5).forEach(field => {
        console.log(`${field}:`, missing[field]);
    });

    await client.close();
})();
