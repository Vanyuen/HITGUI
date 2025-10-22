/**
 * 检查热温冷比计算的详细数据
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/HIT';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const dltSchema = new mongoose.Schema({
    issue: String,
    frontBalls: [Number],
    statistics: {
        frontHotWarmColdRatio: String
    }
}, { collection: 'hit_dlts', strict: false });

const DLT = mongoose.model('HIT_DLT_Check2', dltSchema);

async function checkHWCData() {
    try {
        console.log('正在连接数据库...');
        await mongoose.connection.asPromise();
        console.log('✅ 数据库连接成功\n');

        // 查询最近3期的完整数据
        const records = await DLT.find({})
            .sort({ issue: -1 })
            .limit(3)
            .lean();

        console.log('最近3期的数据详情:\n');
        records.forEach((record, index) => {
            console.log(`═══════════════════════════════════════════════════`);
            console.log(`期号 ${index + 1}: ${record.issue}`);
            console.log(`═══════════════════════════════════════════════════`);
            console.log('前区号码:', record.frontBalls);
            console.log('热温冷比:', record.statistics?.frontHotWarmColdRatio || '(无数据)');
            console.log('\n完整数据:');
            console.log(JSON.stringify(record, null, 2));
            console.log('\n');
        });

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.connection.close();
    }
}

checkHWCData();
