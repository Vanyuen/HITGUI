const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/hit_lottery')
    .then(async () => {
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // 查询一条样本数据
        const sample = await db.collection('dlthistories').findOne({});
        console.log('\n样本数据结构:');
        console.log(JSON.stringify(sample, null, 2));

        // 统计热温冷比分布
        console.log('\n\n热温冷比统计:');
        const results = await db.collection('dlthistories').aggregate([
            { $group: { _id: '$FrontHotWarmColdRatio', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        console.log('\n所有热温冷比及其出现次数:');
        results.forEach((item, index) => {
            console.log(`${index + 1}. ${item._id || '(空值)'}: ${item.count}次`);
        });

        console.log(`\n总计: ${results.length} 种不同的热温冷比`);

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
