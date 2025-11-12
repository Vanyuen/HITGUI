const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('检查遗漏数据表 Issue 字段类型...\n');

    const count = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
    console.log('总记录数:', count);

    const sample = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').findOne();
    console.log('\n示例记录:');
    console.log('  Issue:', sample.Issue);
    console.log('  Issue类型:', typeof sample.Issue);

    // 按Issue降序（字符串排序）
    const sortedStr = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}, { projection: { Issue: 1 } })
        .sort({ Issue: -1 })
        .limit(10)
        .toArray();

    console.log('\n按Issue降序排列的前10期（字符串排序）:');
    sortedStr.forEach(r => {
        console.log(`  Issue: ${r.Issue}`);
    });

    // 查找期号25114
    const issue25114 = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({ Issue: "25114" });

    if (issue25114) {
        console.log('\n✅ 找到期号25114（字符串查询）');
    } else {
        console.log('\n❌ 没有找到期号25114（字符串查询）');
    }

    // 查找期号>=25000的记录
    const count25000 = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .countDocuments({ Issue: { $gte: "25000" } });

    console.log(`\n期号 >= "25000" 的记录数: ${count25000}`);

    const count10000 = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .countDocuments({ Issue: { $gte: "10000" } });

    console.log(`期号 >= "10000" 的记录数: ${count10000}`);

    await client.close();
})();
