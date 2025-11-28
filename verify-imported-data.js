// 验证导入的数据
const mongoose = require('mongoose');

async function verifyData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接到MongoDB\n');

        const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

        // 查询最新导入的两条记录
        const records = await hit_dlts.find({ Issue: { $in: ['25120', '25121'] } })
            .sort({ Issue: -1 })
            .lean();

        console.log('========== 验证导入数据 ==========\n');

        records.forEach(record => {
            console.log(`期号: ${record.Issue}`);
            console.log(`  红球: ${record.R1} ${record.R2} ${record.R3} ${record.R4} ${record.R5}`);
            console.log(`  蓝球: ${record.B1} ${record.B2}`);
            console.log(`  销售额: ${record.Sales}`);
            console.log(`  一等奖注数: ${record.FirstPrizeCount}`);
            console.log(`  一等奖单注奖金: ${record.FirstPrizeAmount}`);
            console.log(`  开奖日期: ${record.Date}`);
            console.log('');
        });

        await mongoose.connection.close();
    } catch (error) {
        console.error('错误:', error.message);
    }
}

verifyData();
