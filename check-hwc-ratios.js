/**
 * 查看数据库中大乐透历史数据的热温冷比分布
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 连接MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/HIT';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// hit_dlts Schema
const dltSchema = new mongoose.Schema({
    issue: { type: String, required: true, unique: true },
    drawDate: { type: Date },
    frontBalls: [Number],
    backBalls: [Number],
    statistics: {
        frontSum: Number,
        frontSpan: Number,
        frontHotWarmColdRatio: String,
        frontZoneRatio: String,
        frontOddEvenRatio: String,
        frontAcValue: Number
    }
}, { collection: 'hit_dlts' });

const hit_dlts = mongoose.model('HIT_DLT_Check', dltSchema);

async function checkHWCRatios() {
    try {
        console.log('正在连接数据库...');
        await mongoose.connection.asPromise();
        console.log('✅ 数据库连接成功\n');

        // 查询最近100期的热温冷比分布
        console.log('📊 查询最近100期的热温冷比分布...\n');

        const records = await hit_dlts.find({})
            .select('issue statistics.frontHotWarmColdRatio')
            .sort({ issue: -1 })
            .limit(100)
            .lean();

        console.log(`找到 ${records.length} 条记录\n`);

        // 统计热温冷比分布
        const hwcDistribution = {};
        const recordsWithHWC = [];
        const recordsWithoutHWC = [];

        records.forEach(record => {
            const hwcRatio = record.statistics?.frontHotWarmColdRatio;
            if (hwcRatio) {
                hwcDistribution[hwcRatio] = (hwcDistribution[hwcRatio] || 0) + 1;
                recordsWithHWC.push({ issue: record.issue, hwcRatio });
            } else {
                recordsWithoutHWC.push(record.issue);
            }
        });

        console.log('═══════════════════════════════════════════════════');
        console.log('热温冷比分布统计（按出现次数排序）');
        console.log('═══════════════════════════════════════════════════\n');

        // 按出现次数排序
        const sortedHWC = Object.entries(hwcDistribution)
            .sort((a, b) => b[1] - a[1]);

        sortedHWC.forEach(([ratio, count], index) => {
            const percentage = ((count / records.length) * 100).toFixed(1);
            const bar = '█'.repeat(Math.ceil(count / 2));
            console.log(`${String(index + 1).padStart(2, ' ')}. ${ratio.padEnd(7, ' ')} │ ${String(count).padStart(3, ' ')}次 (${percentage.padStart(5, ' ')}%) ${bar}`);
        });

        console.log('\n═══════════════════════════════════════════════════');
        console.log(`总计：${sortedHWC.length} 种不同的热温冷比`);
        console.log(`有热温冷比数据：${recordsWithHWC.length} 期`);
        console.log(`无热温冷比数据：${recordsWithoutHWC.length} 期`);
        console.log('═══════════════════════════════════════════════════\n');

        if (recordsWithoutHWC.length > 0) {
            console.log('⚠️  缺少热温冷比数据的期号:');
            console.log(recordsWithoutHWC.slice(0, 10).join(', '));
            if (recordsWithoutHWC.length > 10) {
                console.log(`... 还有 ${recordsWithoutHWC.length - 10} 期\n`);
            } else {
                console.log('');
            }
        }

        console.log('💡 推荐选择（出现次数最多的前5个热温冷比）:');
        sortedHWC.slice(0, 5).forEach(([ratio, count], index) => {
            console.log(`   ${index + 1}. ${ratio} (${count}次)`);
        });
        console.log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');
    }
}

checkHWCRatios();
