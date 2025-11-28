const mongoose = require('mongoose');

async function verifyStatisticsFields() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        console.log('\n=== 大乐透走势图统计列数据验证 ===\n');

        // 定义Schema
        const dltRedMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories' });
        const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });

        // 1. 检查DLTRedMissing表（遗漏值表）
        const DLTRedMissing = mongoose.models.HIT_DLT_Basictrendchart_redballmissing_history || mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', dltRedMissingSchema);
        const redMissingCount = await DLTRedMissing.countDocuments();
        console.log(`1. DLTRedMissing表记录数: ${redMissingCount}`);

        if (redMissingCount > 0) {
            const redSample = await DLTRedMissing.findOne({}).sort({ID: -1}).lean();
            const fields = Object.keys(redSample).filter(k => !k.match(/^[0-9]+$/));
            console.log(`   字段列表: ${fields.join(', ')}`);
            console.log(`   最新期号: ${redSample.Issue}`);
            console.log(`   热温冷比字段存在: ${redSample.FrontHotWarmColdRatio ? 'YES' : 'NO'}`);
            if (redSample.FrontHotWarmColdRatio) {
                console.log(`   热温冷比示例: ${redSample.FrontHotWarmColdRatio}`);
            }
        }

        // 2. 检查hit_dlts主表
        const hit_dlts = mongoose.models.hit_dlts || mongoose.model('hit_dlts', dltSchema);
        const dltCount = await hit_dlts.countDocuments();
        console.log(`\n2. hit_dlts主表记录数: ${dltCount}`);

        if (dltCount > 0) {
            const dltSample = await hit_dlts.findOne({}).sort({Issue: -1}).lean();
            console.log(`   最新期号: ${dltSample.Issue}`);
            console.log(`   statistics字段存在: ${dltSample.statistics ? 'YES' : 'NO'}`);

            if (dltSample.statistics) {
                console.log(`   统计字段内容:`);
                console.log(`     - frontSum: ${dltSample.statistics.frontSum}`);
                console.log(`     - frontSpan: ${dltSample.statistics.frontSpan}`);
                console.log(`     - frontHotWarmColdRatio: ${dltSample.statistics.frontHotWarmColdRatio}`);
                console.log(`     - frontZoneRatio: ${dltSample.statistics.frontZoneRatio}`);
                console.log(`     - frontOddEvenRatio: ${dltSample.statistics.frontOddEvenRatio}`);
                console.log(`     - frontAcValue: ${dltSample.statistics.frontAcValue}`);
                console.log(`     - backSum: ${dltSample.statistics.backSum}`);
                console.log(`     - backOddEvenRatio: ${dltSample.statistics.backOddEvenRatio}`);
            }
        }

        // 3. 数据完整性统计
        console.log(`\n3. 数据完整性统计:`);

        if (redMissingCount > 0) {
            const withHWC = await DLTRedMissing.countDocuments({
                FrontHotWarmColdRatio: { $exists: true, $ne: null, $ne: '' }
            });
            console.log(`   DLTRedMissing表有热温冷比的记录: ${withHWC} / ${redMissingCount} (${(withHWC/redMissingCount*100).toFixed(1)}%)`);
        }

        if (dltCount > 0) {
            const withStats = await hit_dlts.countDocuments({
                'statistics.frontSum': { $exists: true }
            });
            console.log(`   hit_dlts主表有statistics的记录: ${withStats} / ${dltCount} (${(withStats/dltCount*100).toFixed(1)}%)`);
        }

        // 4. 数据来源总结
        console.log(`\n4. 走势图数据来源策略:`);
        console.log(`   优先级1: hit_dlts主表的statistics字段 (预处理)`);
        console.log(`   优先级2: DLTRedMissing表的FrontHotWarmColdRatio (遗漏值表)`);
        console.log(`   优先级3: 实时计算 (兜底)`);

        console.log(`\n5. 统计列完整列表:`);
        console.log(`   ✓ 前区和值 (frontSum) - 计算来源: 5个红球号码相加`);
        console.log(`   ✓ 前区跨度 (frontSpan) - 计算来源: 最大号码 - 最小号码`);
        console.log(`   ✓ 热温冷比 (frontHotWarmColdRatio) - 计算来源: 基于上期遗漏值`);
        console.log(`   ✓ 区间比 (frontZoneRatio) - 计算来源: 1-12:13-24:25-35区间分布`);
        console.log(`   ✓ AC值 (frontAcValue) - 计算来源: 算术复杂度（号码离散程度）`);
        console.log(`   ✓ 前区奇偶 (frontOddEvenRatio) - 计算来源: 奇数:偶数个数比`);
        console.log(`   ✓ 后区和值 (backSum) - 计算来源: 2个蓝球号码相加`);
        console.log(`   ✓ 后区奇偶 (backOddEvenRatio) - 计算来源: 奇数:偶数个数比`);

        console.log(`\n验证完成！\n`);

        process.exit(0);
    } catch (error) {
        console.error('验证失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyStatisticsFields();
