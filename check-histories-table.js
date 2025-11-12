const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('=== 检查 hit_dlt_redballmissing_histories 表 ===\n');

    const count = await db.collection('hit_dlt_redballmissing_histories').countDocuments();
    console.log('总记录数:', count);

    if (count === 0) {
        console.log('❌ hit_dlt_redballmissing_histories 表为空！');
        await client.close();
        return;
    }

    // 检查最新的记录
    const latest = await db.collection('hit_dlt_redballmissing_histories')
        .find()
        .sort({ Issue: -1 })
        .limit(5)
        .toArray();

    console.log('\n=== 最新5期 ===');
    latest.forEach(record => {
        console.log(`期号: ${record.Issue}`);
    });

    // 检查期号25114的数据
    const issue25114 = await db.collection('hit_dlt_redballmissing_histories')
        .findOne({ Issue: 25114 });

    if (!issue25114) {
        console.log('\n❌ 期号25114没有数据');
        console.log('使用最新一期数据进行结构检查:', latest[0].Issue);
        const sample = latest[0];

        console.log('\n=== 数据结构检查 ===');
        console.log('所有字段:', Object.keys(sample));

        // 检查球号字段
        const ballFields = Object.keys(sample).filter(k => !k.startsWith('_') && k !== 'Issue');
        console.log('\n球号字段数量:', ballFields.length);
        console.log('前10个球号字段:', ballFields.slice(0, 10));

        console.log('\n=== 字段值示例 ===');
        ballFields.slice(0, 5).forEach(field => {
            console.log(`${field}:`, sample[field]);
        });

        await client.close();
        return;
    }

    console.log('\n✅ 找到期号25114的数据');
    console.log('=== 数据结构检查 ===');
    console.log('所有字段:', Object.keys(issue25114));

    // 检查球号字段
    const ballFields = Object.keys(issue25114).filter(k => !k.startsWith('_') && k !== 'Issue');
    console.log('\n球号字段数量:', ballFields.length);
    console.log('前10个球号字段:', ballFields.slice(0, 10));

    // 测试不同字段名格式
    console.log('\n=== 测试字段名格式 ===');
    console.log('issue25114["1"]:', issue25114['1']);
    console.log('issue25114["01"]:', issue25114['01']);
    console.log('issue25114.Red1:', issue25114.Red1);

    console.log('\n=== 字段值示例（前5个） ===');
    ballFields.slice(0, 5).forEach(field => {
        console.log(`${field}:`, issue25114[field]);
    });

    await client.close();
})();
