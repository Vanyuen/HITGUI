const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const DLT = mongoose.model('HIT_DLT', new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT' }));

    // 获取最新的5条记录
    const records = await DLT.find().sort({ Issue: -1 }).limit(5).lean();

    console.log('========== 数据库中最新的5条记录 ==========\n');
    records.forEach(r => {
        console.log(`期号: ${r.Issue}`);
        console.log(`  ID: ${r.ID}`);
        console.log(`  红球: ${r.R1} ${r.R2} ${r.R3} ${r.R4} ${r.R5}`);
        console.log(`  蓝球: ${r.B1} ${r.B2}`);
        console.log(`  开奖日期: ${r.Date}`);
        console.log(`  销售额: ${r.Sales}`);
        console.log('');
    });

    // 检查25122和25123是否存在
    const check122 = await DLT.findOne({ Issue: '25122' }).lean();
    const check123 = await DLT.findOne({ Issue: '25123' }).lean();

    console.log('\n========== 检查特定期号 ==========');
    console.log('期号 25122:', check122 ? '✅ 存在' : '❌ 不存在');
    console.log('期号 25123:', check123 ? '✅ 存在' : '❌ 不存在');

    if (check122) {
        console.log('\n25122详情:', JSON.stringify(check122, null, 2));
    }
    if (check123) {
        console.log('\n25123详情:', JSON.stringify(check123, null, 2));
    }

    await mongoose.connection.close();
}).catch(err => {
    console.error('数据库连接失败:', err);
});
