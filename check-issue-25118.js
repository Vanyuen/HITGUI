const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 检查25115-25125期的真实开奖状态\n');

    const issues = await db.collection('hit_dlts')
        .find({ Issue: { $gte: 25115, $lte: 25125 } })
        .sort({ Issue: 1 })
        .toArray();

    console.log('期号\t开奖状态\t红球\t\t\t\t蓝球');
    console.log('─'.repeat(80));

    issues.forEach(i => {
        const reds = [i.Red_1, i.Red_2, i.Red_3, i.Red_4, i.Red_5];
        const blues = [i.Blue_1, i.Blue_2];
        console.log(`${i.Issue}\t✅已开奖\t${reds.join(',')}\t\t${blues.join(',')}`);
    });

    console.log(`\n共找到 ${issues.length} 期已开奖数据`);

    // 检查是否有25118
    const has25118 = issues.find(i => i.Issue === 25118);
    const has25119 = issues.find(i => i.Issue === 25119);

    console.log('\n📋 关键检查:');
    console.log(`  25118期: ${has25118 ? '✅ 已开奖' : '❌ 未开奖'}`);
    console.log(`  25119期: ${has25119 ? '✅ 已开奖' : '❌ 未开奖'}`);

    // 检查最新已开奖期号
    const latest = await db.collection('hit_dlts')
        .find({})
        .sort({ Issue: -1 })
        .limit(1)
        .toArray();

    console.log(`\n📊 最新已开奖期号: ${latest[0]?.Issue || 'N/A'}`);

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
