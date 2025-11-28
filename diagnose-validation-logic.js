/**
 * 快速检查验证逻辑问题
 */

const mongoose = require('mongoose');

async function checkValidation() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_val', hit_dltsSchema);

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const HWCModel = mongoose.model('HWCVal', DLTRedCombinationsHotWarmColdOptimizedSchema);

        const DLTComboFeaturesSchema = new mongoose.Schema({}, { collection: 'hit_dlt_combofeatures', strict: false });
        const DLTComboFeatures = mongoose.model('DLTComboFeatures_val', DLTComboFeaturesSchema);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 当前数据状态');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const dltCount = await hit_dlts.countDocuments();
        const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const blueMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
        const comboFeaturesCount = await DLTComboFeatures.countDocuments();
        const statisticsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });
        const hwcOptimizedCount = await HWCModel.countDocuments();

        console.log(`   hit_dlts: ${dltCount} 期`);
        console.log(`   红球遗漏: ${redMissingCount} 期`);
        console.log(`   蓝球遗漏: ${blueMissingCount} 期`);
        console.log(`   组合特征: ${comboFeaturesCount} 期`);
        console.log(`   statistics字段: ${statisticsCount} 期`);
        console.log(`   热温冷比优化表: ${hwcOptimizedCount} 条\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 验证逻辑分析');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 当前验证逻辑（src/server/server.js:29358-29366）
        const expectedHWCCountCurrent = dltCount > 0 ? dltCount : 0;
        const allCompleteCurrent =
            dltCount === redMissingCount &&
            dltCount === blueMissingCount &&
            dltCount === comboFeaturesCount &&
            dltCount === statisticsCount &&
            hwcOptimizedCount === expectedHWCCountCurrent;

        console.log(`📌 当前验证逻辑:`);
        console.log(`   期望热温冷比记录数: ${expectedHWCCountCurrent}`);
        console.log(`   实际热温冷比记录数: ${hwcOptimizedCount}`);
        console.log(`   验证结果: ${allCompleteCurrent ? '✅ 通过' : '❌ 失败'}\n`);

        if (!allCompleteCurrent) {
            console.log(`   ❌ 问题: 期望${expectedHWCCountCurrent}条，实际${hwcOptimizedCount}条，差${expectedHWCCountCurrent - hwcOptimizedCount}条\n`);
        }

        // 正确的验证逻辑
        const expectedHWCCountCorrect = dltCount > 0 ? dltCount - 1 : 0;
        const allCompleteCorrect =
            dltCount === redMissingCount &&
            dltCount === blueMissingCount &&
            dltCount === comboFeaturesCount &&
            dltCount === statisticsCount &&
            hwcOptimizedCount === expectedHWCCountCorrect;

        console.log(`📌 正确的验证逻辑:`);
        console.log(`   期望热温冷比记录数: ${expectedHWCCountCorrect} (${dltCount} - 1，因为第1期没有上一期)`);
        console.log(`   实际热温冷比记录数: ${hwcOptimizedCount}`);
        console.log(`   验证结果: ${allCompleteCorrect ? '✅ 通过' : '❌ 失败'}\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 修复建议');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`   修改 src/server/server.js:29359 行:\n`);
        console.log(`   修改前:`);
        console.log(`   const expectedHWCCount = dltCount > 0 ? dltCount : 0;\n`);
        console.log(`   修改后:`);
        console.log(`   const expectedHWCCount = dltCount > 0 ? dltCount - 1 : 0;\n`);
        console.log(`   说明: 第一期(7001)没有上一期，无法生成热温冷比数据，所以期望值应该是 dltCount - 1\n`);

        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkValidation();
