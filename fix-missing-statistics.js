/**
 * 补齐所有缺失的 statistics 数据
 * 运行: node fix-missing-statistics.js
 */
const mongoose = require('mongoose');

// 定义 Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: Number },
    Red1: Number, Red2: Number, Red3: Number, Red4: Number, Red5: Number,
    Blue1: Number, Blue2: Number,
    DrawDate: Date,
    statistics: {
        frontSum: Number,
        frontSpan: Number,
        frontHotWarmColdRatio: String,
        frontZoneRatio: String,
        frontOddEvenRatio: String,
        frontAcValue: Number,
        backSum: Number,
        backOddEvenRatio: String,
        consecutiveCount: Number,
        repeatCount: Number
    },
    updatedAt: Date
}, { collection: 'hit_dlts' });

// AC值计算函数
function calculateACValue(balls) {
    const sorted = [...balls].sort((a, b) => a - b);
    const differences = new Set();
    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            differences.add(sorted[j] - sorted[i]);
        }
    }
    return differences.size - (sorted.length - 1);
}

async function fixStatistics() {
    console.log('🔍 连接数据库...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const HitDlt = mongoose.model('hit_dlts', dltSchema);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔧 补齐 statistics 字段');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. 查找缺少 statistics 的记录
    const recordsWithoutStats = await HitDlt.find({
        $or: [
            { 'statistics.frontSum': { $exists: false } },
            { statistics: { $exists: false } }
        ]
    }).sort({ ID: 1 }).lean();

    console.log(`📊 需要补齐 statistics 的记录数: ${recordsWithoutStats.length}\n`);

    if (recordsWithoutStats.length === 0) {
        console.log('✅ 所有记录都已有 statistics，无需补齐');
        await mongoose.disconnect();
        return;
    }

    // 2. 获取遗漏值数据（用于热温冷比计算）
    const missingCollection = db.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const allMissing = await missingCollection.find({}).toArray();
    const missingMap = new Map();
    allMissing.forEach(r => missingMap.set(r.ID, r));
    console.log(`📥 已加载 ${allMissing.length} 条遗漏值记录\n`);

    // 3. 获取所有记录（用于计算重号）
    const allRecords = await HitDlt.find({}).sort({ ID: 1 }).select('ID Red1 Red2 Red3 Red4 Red5').lean();
    const allRecordsMap = new Map();
    allRecords.forEach(r => allRecordsMap.set(r.ID, r));

    // 4. 逐条处理
    let updateCount = 0;
    let skipCount = 0;

    for (let i = 0; i < recordsWithoutStats.length; i++) {
        const record = recordsWithoutStats[i];
        const reds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const blues = [record.Blue1, record.Blue2];

        // 基础统计计算
        const frontSum = reds.reduce((a, b) => a + b, 0);
        const frontSpan = Math.max(...reds) - Math.min(...reds);

        // 区间比 (1-12, 13-24, 25-35)
        let zone1 = 0, zone2 = 0, zone3 = 0;
        reds.forEach(n => {
            if (n <= 12) zone1++;
            else if (n <= 24) zone2++;
            else zone3++;
        });
        const frontZoneRatio = `${zone1}:${zone2}:${zone3}`;

        // 奇偶比
        let frontOdd = 0, frontEven = 0;
        reds.forEach(n => n % 2 === 0 ? frontEven++ : frontOdd++);
        const frontOddEvenRatio = `${frontOdd}:${frontEven}`;

        // AC值
        const frontAcValue = calculateACValue(reds);

        // 后区统计
        const backSum = blues.reduce((a, b) => a + b, 0);
        let backOdd = 0, backEven = 0;
        blues.forEach(n => n % 2 === 0 ? backEven++ : backOdd++);
        const backOddEvenRatio = `${backOdd}:${backEven}`;

        // 热温冷比：从上一期的遗漏值计算
        let frontHotWarmColdRatio = '0:0:0';
        const previousRecord = allRecordsMap.get(record.ID - 1);
        if (previousRecord) {
            const previousMissingRecord = missingMap.get(previousRecord.ID);
            if (previousMissingRecord) {
                const missingValues = reds.map(ball => previousMissingRecord[String(ball)] || 0);
                let hot = 0, warm = 0, cold = 0;
                missingValues.forEach(missing => {
                    if (missing <= 4) hot++;
                    else if (missing <= 9) warm++;
                    else cold++;
                });
                frontHotWarmColdRatio = `${hot}:${warm}:${cold}`;
            }
        }

        // 连号组数
        const sortedReds = [...reds].sort((a, b) => a - b);
        let consecutiveCount = 0;
        for (let j = 0; j < sortedReds.length - 1; j++) {
            if (sortedReds[j + 1] - sortedReds[j] === 1) {
                consecutiveCount++;
            }
        }

        // 重号数
        let repeatCount = 0;
        if (previousRecord) {
            const prevReds = [previousRecord.Red1, previousRecord.Red2, previousRecord.Red3, previousRecord.Red4, previousRecord.Red5];
            repeatCount = reds.filter(r => prevReds.includes(r)).length;
        }

        // 构建 statistics 对象
        const statistics = {
            frontSum,
            frontSpan,
            frontHotWarmColdRatio,
            frontZoneRatio,
            frontOddEvenRatio,
            frontAcValue,
            backSum,
            backOddEvenRatio,
            consecutiveCount,
            repeatCount
        };

        // 更新数据库
        await HitDlt.updateOne(
            { ID: record.ID },
            { $set: { statistics, updatedAt: new Date() } }
        );

        updateCount++;

        if ((i + 1) % 100 === 0 || i === recordsWithoutStats.length - 1) {
            console.log(`📈 进度: ${i + 1}/${recordsWithoutStats.length} (${((i + 1) / recordsWithoutStats.length * 100).toFixed(1)}%)`);
        }
    }

    console.log(`\n✅ statistics 补齐完成，更新 ${updateCount} 条记录\n`);

    // 验证
    const finalCount = await HitDlt.countDocuments({ 'statistics.frontSum': { $exists: true } });
    const totalCount = await HitDlt.countDocuments();
    console.log(`📊 验证: ${finalCount}/${totalCount} 条记录有 statistics`);

    if (finalCount === totalCount) {
        console.log('✅ 所有记录都已有 statistics!');
    } else {
        console.log(`⚠️  还有 ${totalCount - finalCount} 条记录缺少 statistics`);
    }

    await mongoose.disconnect();
}

fixStatistics().catch(err => {
    console.error('❌ 补齐失败:', err.message);
    process.exit(1);
});
