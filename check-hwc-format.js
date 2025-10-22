const mongoose = require('mongoose');

async function checkHWCFormat() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        console.log('\n=== 检查热温冷比字段格式 ===\n');

        // 定义Schema
        const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
        const DLT = mongoose.models.HIT_DLT || mongoose.model('HIT_DLT', dltSchema);

        // 取最新10期的数据
        const records = await DLT.find({})
            .select('Issue Red1 Red2 Red3 Red4 Red5 statistics')
            .sort({ Issue: -1 })
            .limit(10)
            .lean();

        console.log(`找到 ${records.length} 期数据\n`);

        records.forEach((record, index) => {
            console.log(`${index + 1}. 期号: ${record.Issue}`);
            console.log(`   前区号码: ${record.Red1}, ${record.Red2}, ${record.Red3}, ${record.Red4}, ${record.Red5}`);

            if (record.statistics) {
                console.log(`   statistics字段存在:`);
                console.log(`     - frontHotWarmColdRatio类型: ${typeof record.statistics.frontHotWarmColdRatio}`);
                console.log(`     - frontHotWarmColdRatio值: "${record.statistics.frontHotWarmColdRatio}"`);
                console.log(`     - frontSum: ${record.statistics.frontSum}`);
                console.log(`     - frontSpan: ${record.statistics.frontSpan}`);
            } else {
                console.log(`   statistics字段不存在`);
            }
            console.log('');
        });

        // 统计不同热温冷比的分布
        console.log('\n=== 热温冷比分布统计 ===\n');

        const allRecords = await DLT.find({
            'statistics.frontHotWarmColdRatio': { $exists: true, $ne: null }
        })
        .select('statistics.frontHotWarmColdRatio')
        .lean();

        const distribution = {};
        allRecords.forEach(rec => {
            const ratio = rec.statistics.frontHotWarmColdRatio;
            distribution[ratio] = (distribution[ratio] || 0) + 1;
        });

        const sorted = Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        console.log('TOP 15 热温冷比:');
        sorted.forEach(([ratio, count]) => {
            console.log(`  ${ratio}: ${count}次`);
        });

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('检查失败:', error);
        process.exit(1);
    }
}

checkHWCFormat();
