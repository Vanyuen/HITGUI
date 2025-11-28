const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const hit_dlts = mongoose.connection.db.collection('hit_dlts');

    // 先获取所有的Issue字段类型
    const sample = await hit_dlts.findOne();
    console.log('Issue字段类型:', typeof sample.Issue);
    console.log('Issue字段示例:', sample.Issue);

    // 获取最近的10期
    const recent10 = await hit_dlts.find().sort({ ID: -1 }).limit(10).toArray();
    console.log('\n最近10期数据:');
    recent10.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}, 类型: ${typeof record.Issue}`);
    });

    // 查找25开头的期号
    const issue25 = await hit_dlts.find({
        Issue: /^25/
    }).sort({ Issue: 1 }).limit(20).toArray();

    console.log('\n25开头的期号:');
    issue25.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
