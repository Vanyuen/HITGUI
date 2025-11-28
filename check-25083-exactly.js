const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const hit_dlts = mongoose.connection.db.collection('hit_dlts');

    // 检查25083
    const record25083 = await hit_dlts.findOne({ Issue: 25083 });
    console.log('期号25083存在:', !!record25083);

    if (record25083) {
        console.log('25083详情:', record25083);
    }

    // 查找25080-25090范围
    const range = await hit_dlts.find({
        Issue: { $gte: 25080, $lte: 25090 }
    }).sort({ Issue: 1 }).toArray();

    console.log('\n25080-25090范围的期号:');
    range.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    // 查找最早的ID
    const earliest = await hit_dlts.find().sort({ ID: 1 }).limit(5).toArray();
    console.log('\n最早的5期:');
    earliest.forEach(record => {
        console.log(`  期号: ${record.Issue}, ID: ${record.ID}`);
    });

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
