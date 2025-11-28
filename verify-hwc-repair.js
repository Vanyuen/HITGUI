const mongoose = require('mongoose');

async function verifyHWCRepair() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
        const hit_dlts = mongoose.model('HIT_DLT_Verify', dltSchema);

        console.log('\n=== 验证热温冷比修复结果 ===\n');

        // 查询 3:2:0 的记录
        const ratio320 = await hit_dlts.find({ 'statistics.frontHotWarmColdRatio': '3:2:0' })
            .select('Issue statistics.frontHotWarmColdRatio Red1 Red2 Red3 Red4 Red5')
            .sort({ Issue: -1 })
            .limit(10)
            .lean();

        console.log(`✅ 找到 ${ratio320.length} 条 热温冷比=3:2:0 的记录（显示最新10期）:\n`);
        ratio320.forEach(rec => {
            console.log(`  期号 ${rec.Issue}: ${rec.statistics.frontHotWarmColdRatio} - 红球[${rec.Red1}, ${rec.Red2}, ${rec.Red3}, ${rec.Red4}, ${rec.Red5}]`);
        });

        // 统计所有热温冷比的分布
        const allRecords = await hit_dlts.find({ 'statistics.frontHotWarmColdRatio': { $exists: true } })
            .select('statistics.frontHotWarmColdRatio')
            .lean();

        const distribution = {};
        allRecords.forEach(rec => {
            const ratio = rec.statistics.frontHotWarmColdRatio;
            distribution[ratio] = (distribution[ratio] || 0) + 1;
        });

        console.log(`\n📊 热温冷比分布统计（共${allRecords.length}期）:\n`);
        Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .forEach(([ratio, count]) => {
                const percentage = (count / allRecords.length * 100).toFixed(1);
                const bar = '█'.repeat(Math.round(count / 20));
                console.log(`  ${ratio.padEnd(7)} ${String(count).padStart(4)}次 (${String(percentage).padStart(5)}%) ${bar}`);
            });

        // 检查是否还有错误的 "0:0:5"
        const errorRatio = distribution['0:0:5'] || 0;
        console.log(`\n🔍 错误数据检查:`);
        console.log(`  "0:0:5" 记录数: ${errorRatio} (${(errorRatio / allRecords.length * 100).toFixed(1)}%)`);

        if (errorRatio > allRecords.length * 0.1) {
            console.log('  ⚠️  警告: 仍有超过10%的错误数据');
        } else if (errorRatio > 0) {
            console.log('  ⚠️  警告: 仍有少量错误数据');
        } else {
            console.log('  ✅ 没有错误数据');
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('验证失败:', error);
        process.exit(1);
    }
}

verifyHWCRepair();
