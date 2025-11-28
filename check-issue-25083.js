const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const hit_dlts = mongoose.connection.db.collection('hit_dlts');

    // 查找25083附近的期号
    const nearby = await hit_dlts.find({
        Issue: { $gte: '25080', $lte: '25090' }
    }).sort({ Issue: 1 }).toArray();

    console.log('25080-25090期号范围的数据:');
    nearby.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    // 查找25083之前的期号
    const before = await hit_dlts.find({
        Issue: { $lt: '25083' }
    }).sort({ Issue: -1 }).limit(5).toArray();

    console.log('\n25083之前的5期:');
    before.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    // 查找25083之后的期号
    const after = await hit_dlts.find({
        Issue: { $gt: '25083' }
    }).sort({ Issue: 1 }).limit(5).toArray();

    console.log('\n25083之后的5期:');
    after.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
