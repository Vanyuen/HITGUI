/**
 * 检查热温冷优化表中的数据
 */

const mongoose = require('mongoose');

const hwcOptimizedSchema = new mongoose.Schema({
    base_issue: String,
    target_issue: String,
    hot_warm_cold_data: Map,
    total_combinations: Number,
    created_at: Date
});

const HwcOptimized = mongoose.model(
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    hwcOptimizedSchema,
    'hit_dlt_redcombinationshotwarmcoldoptimizeds'
);

async function checkData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('=== 检查热温冷优化表数据 ===\n');

        // 测试期号对: 25114->25115, 25115->25116, ..., 25124->25125
        const testPairs = [];
        for (let i = 25114; i <= 25124; i++) {
            testPairs.push({ base: String(i), target: String(i + 1) });
        }

        console.log('检查以下期号对的数据:\n');

        for (const pair of testPairs) {
            const record = await HwcOptimized.findOne({
                base_issue: pair.base,
                target_issue: pair.target
            }).lean();

            if (record) {
                // 检查是否有4:1:0的数据
                let has410 = false;
                let count410 = 0;

                if (record.hot_warm_cold_data) {
                    const hwcData = record.hot_warm_cold_data;
                    const key410 = '4:1:0';

                    if (hwcData instanceof Map) {
                        has410 = hwcData.has(key410);
                        count410 = has410 ? hwcData.get(key410).length : 0;
                    } else if (typeof hwcData === 'object') {
                        has410 = key410 in hwcData;
                        count410 = has410 ? hwcData[key410].length : 0;
                    }
                }

                console.log(`${pair.base} → ${pair.target}:`);
                console.log(`  总组合数: ${record.total_combinations || 0}`);
                console.log(`  有4:1:0数据: ${has410 ? '是' : '否'}`);
                if (has410) {
                    console.log(`  4:1:0组合数: ${count410}`);
                }
            } else {
                console.log(`${pair.base} → ${pair.target}: ❌ 没有数据记录`);
            }
            console.log('');
        }

        // 检查总记录数
        const totalCount = await HwcOptimized.countDocuments({});
        console.log(`\n总记录数: ${totalCount}`);

        // 检查最新的几条记录
        const latestRecords = await HwcOptimized
            .find({})
            .sort({ created_at: -1 })
            .limit(5)
            .select('base_issue target_issue total_combinations created_at')
            .lean();

        console.log('\n最新的5条记录:');
        latestRecords.forEach((record, index) => {
            console.log(`  ${index + 1}. ${record.base_issue} → ${record.target_issue} (${record.total_combinations} combos) - ${record.created_at}`);
        });

        console.log('\n=== 检查完成 ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkData();
