const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('=== 检查 hit_dlt_basictrendchart_redballmissing_histories 表 ===\n');

    const count = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    console.log('✅ 总记录数:', count);

    // 检查最新的记录
    const latest = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find()
        .sort({ Issue: -1 })
        .limit(5)
        .toArray();

    console.log('\n=== 最新5期 ===');
    latest.forEach(record => {
        console.log(`期号: ${record.Issue}`);
    });

    // 检查期号25114的数据
    const issue25114 = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({ Issue: 25114 });

    if (!issue25114) {
        console.log('\n⚠️ 期号25114没有数据，使用最新一期:', latest[0].Issue);

        const sample = latest[0];
        console.log('\n=== 数据结构检查 (使用期号 ' + sample.Issue + ') ===');
        const allFields = Object.keys(sample);
        console.log('所有字段:', allFields);

        const ballFields = allFields.filter(k => !k.startsWith('_') && k !== 'Issue');
        console.log('\n球号字段数量:', ballFields.length);
        console.log('前15个球号字段:', ballFields.slice(0, 15));

        console.log('\n=== 测试字段名格式 ===');
        console.log('sample["1"]:', sample['1']);
        console.log('sample["01"]:', sample['01']);
        console.log('sample["10"]:', sample['10']);
        console.log('sample["35"]:', sample['35']);

        console.log('\n=== 字段值示例（前10个） ===');
        ballFields.slice(0, 10).forEach(field => {
            console.log(`${field}:`, sample[field]);
        });

        await client.close();
        return;
    }

    console.log('\n✅ 找到期号25114的数据');
    console.log('=== 数据结构检查 ===');
    const allFields = Object.keys(issue25114);
    console.log('所有字段:', allFields);

    const ballFields = allFields.filter(k => !k.startsWith('_') && k !== 'Issue');
    console.log('\n球号字段数量:', ballFields.length);
    console.log('前15个球号字段:', ballFields.slice(0, 15));

    // 测试不同字段名格式
    console.log('\n=== 测试字段名格式 ===');
    console.log('issue25114["1"]:', issue25114['1']);
    console.log('issue25114["01"]:', issue25114['01']);
    console.log('issue25114["10"]:', issue25114['10']);
    console.log('issue25114["35"]:', issue25114['35']);

    console.log('\n=== 字段值示例（前10个） ===');
    ballFields.slice(0, 10).forEach(field => {
        console.log(`${field}:`, issue25114[field]);
    });

    // 测试热温冷分类
    console.log('\n=== 测试热温冷分类 ===');
    let hot = 0, warm = 0, cold = 0;

    for (let i = 1; i <= 35; i++) {
        const missing = issue25114[String(i)];
        if (missing !== undefined) {
            if (missing <= 4) hot++;
            else if (missing >= 5 && missing <= 9) warm++;
            else cold++;
        }
    }

    console.log(`热号(≤4): ${hot}个`);
    console.log(`温号(5-9): ${warm}个`);
    console.log(`冷号(≥10): ${cold}个`);

    await client.close();
})();
