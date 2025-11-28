const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    // 检查所有hit_dlts相关的collection
    const colls = await db.listCollections().toArray();
    console.log('🔍 所有hit_dlts相关Collection:');
    colls.filter(c => c.name.includes('hit_dlts') || c.name.includes('dlt')).forEach(c => {
        console.log('  - ' + c.name);
    });

    // 尝试不同的collection名称
    const possibleNames = ['hit_dlts', 'hit_dlts', 'hit_dlts', 'dlt'];

    console.log('\n📊 尝试不同的Collection名称:');
    for (const name of possibleNames) {
        try {
            const count = await db.collection(name).countDocuments();
            console.log(`  ${name}: ${count} 条记录`);

            if (count > 0) {
                // 查找最新的几期
                const latest = await db.collection(name)
                    .find({})
                    .sort({ Issue: -1 })
                    .limit(10)
                    .toArray();

                console.log(`    最新10期: ${latest.map(i => i.Issue).join(', ')}`);

                // 检查25118-25125
                const range = await db.collection(name)
                    .find({ Issue: { $gte: 25115, $lte: 25125 } })
                    .sort({ Issue: 1 })
                    .toArray();

                console.log(`    25115-25125范围内: ${range.map(i => i.Issue).join(', ') || '无'}`);
            }
        } catch (err) {
            console.log(`  ${name}: 不存在`);
        }
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
