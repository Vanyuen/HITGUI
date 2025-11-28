const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    const records = await hit_dlts.find({ Issue: { $in: ['25120', '25121'] } }).sort({ Issue: -1 }).lean();

    console.log('找到', records.length, '条记录:\n');

    records.forEach(r => {
        console.log(`期号 ${r.Issue}:`);
        console.log(`  红球: ${r.R1}-${r.R2}-${r.R3}-${r.R4}-${r.R5}`);
        console.log(`  蓝球: ${r.B1}-${r.B2}`);
        console.log(`  销售额: ${r.Sales}`);
        console.log(`  一等奖注数: ${r.FirstPrizeCount}`);
        console.log(`  一等奖单注: ${r.FirstPrizeAmount}`);
        console.log(`  日期: ${r.Date}`);
        console.log('');
    });

    await mongoose.connection.close();
});
