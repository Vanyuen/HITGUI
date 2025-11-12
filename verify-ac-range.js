// 验证AC值的实际范围
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    console.log('🔍 验证AC值范围\n');

    // 查询AC值分布
    const result = await mongoose.connection.db.collection('hit_dlt_redcombinations')
        .aggregate([
            { $group: { _id: '$ac_value', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

    console.log('📊 数据库中AC值分布:');
    result.forEach(r => {
        const percentage = (r.count / 324632 * 100).toFixed(2);
        console.log(`  AC值 ${r._id}: ${r.count.toLocaleString().padStart(8)} 个组合 (${percentage}%)`);
    });

    const maxAC = Math.max(...result.map(r => r._id));
    const minAC = Math.min(...result.map(r => r._id));

    console.log(`\n📈 统计结果:`);
    console.log(`  最小AC值: ${minAC}`);
    console.log(`  最大AC值: ${maxAC}`);
    console.log(`  AC值种类: ${result.length} 种`);

    // 查看一些示例
    console.log(`\n📋 AC值示例:`);

    // AC值=0的示例
    const ac0 = await mongoose.connection.db.collection('hit_dlt_redcombinations')
        .find({ ac_value: 0 }).limit(3).toArray();
    console.log(`\n  AC值=0 (最规律) 的组合示例:`);
    ac0.forEach(c => {
        const nums = [c.num1, c.num2, c.num3, c.num4, c.num5];
        console.log(`    [${nums.join(', ')}]`);
    });

    // AC值=最大值的示例
    const acMax = await mongoose.connection.db.collection('hit_dlt_redcombinations')
        .find({ ac_value: maxAC }).limit(3).toArray();
    console.log(`\n  AC值=${maxAC} (最离散) 的组合示例:`);
    acMax.forEach(c => {
        const nums = [c.num1, c.num2, c.num3, c.num4, c.num5];
        console.log(`    [${nums.join(', ')}]`);
    });

    console.log(`\n✅ 结论: AC值实际范围是 ${minAC}-${maxAC}，而非文档中标注的 0-10`);

    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
