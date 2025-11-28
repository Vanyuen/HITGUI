const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    const records = await hit_dlts.find({ Issue: { $in: ['25120', '25121'] } }).sort({ Issue: -1 }).lean();

    console.log('========== 验证所有16个字段 ==========\n');

    if (records.length === 0) {
        console.log('未找到记录，可能期号不存在');
    } else {
        records.forEach(r => {
            console.log(`期号 ${r.Issue}:`);
            console.log(`  1. ID: ${r.ID}`);
            console.log(`  2. Issue: ${r.Issue}`);
            console.log(`  3-7. 红球: ${r.R1} ${r.R2} ${r.R3} ${r.R4} ${r.R5}`);
            console.log(`  8-9. 蓝球: ${r.B1} ${r.B2}`);
            console.log(`  10. PoolPrize (奖池): ${r.PoolPrize || '未设置'}`);
            console.log(`  11. FirstPrizeCount (一等奖注数): ${r.FirstPrizeCount}`);
            console.log(`  12. FirstPrizeAmount (一等奖单注): ${r.FirstPrizeAmount}`);
            console.log(`  13. SecondPrizeCount (二等奖注数): ${r.SecondPrizeCount || '未设置'}`);
            console.log(`  14. SecondPrizeAmount (二等奖单注): ${r.SecondPrizeAmount || '未设置'}`);
            console.log(`  15. Sales (销售额): ${r.Sales}`);
            console.log(`  16. Date (开奖日期): ${r.Date}`);
            console.log('');
        });
    }

    await mongoose.connection.close();
});
