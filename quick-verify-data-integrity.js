/**
 * 快速验证修复后的数据完整性
 */

const mongoose = require('mongoose');

async function quickVerify() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 数据完整性验证');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const db = mongoose.connection.db;

        // 定义Schema和Model
        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_verify', hit_dltsSchema);

        const DLTComboFeaturesSchema = new mongoose.Schema({}, { collection: 'hit_dlt_combofeatures', strict: false });
        const DLTComboFeatures = mongoose.model('DLTComboFeatures_verify', DLTComboFeaturesSchema);

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'DLTRedCombinationsHotWarmColdOptimized_verify',
            DLTRedCombinationsHotWarmColdOptimizedSchema
        );

        // 获取各表记录数
        const dltCount = await hit_dlts.countDocuments();
        const redMissingCount = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const blueMissingCount = await db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
        const comboFeaturesCount = await DLTComboFeatures.countDocuments();
        const statisticsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();

        // 显示结果
        console.log(`📊 hit_dlts:              ${dltCount.toString().padStart(4)} 期 ${dltCount === 2792 ? '✅' : '❌'}`);
        console.log(`📊 红球遗漏表:            ${redMissingCount.toString().padStart(4)} 期 ${redMissingCount === 2792 ? '✅' : '❌'}`);
        console.log(`📊 蓝球遗漏表:            ${blueMissingCount.toString().padStart(4)} 期 ${blueMissingCount === 2792 ? '✅' : '❌'}`);
        console.log(`📊 组合特征表:            ${comboFeaturesCount.toString().padStart(4)} 期 ${comboFeaturesCount === 2792 ? '✅' : '❌'}`);
        console.log(`📊 statistics字段:        ${statisticsCount.toString().padStart(4)} 期 ${statisticsCount === 2792 ? '✅' : '❌'}`);
        console.log(`📊 热温冷比优化表:        ${hwcOptimizedCount.toString().padStart(4)} 条 ${hwcOptimizedCount === 2792 ? '✅' : '❌'}`);

        const expectedHWCCount = dltCount > 0 ? dltCount : 0;
        const allComplete =
            dltCount === redMissingCount &&
            dltCount === blueMissingCount &&
            dltCount === comboFeaturesCount &&
            dltCount === statisticsCount &&
            hwcOptimizedCount === expectedHWCCount;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (allComplete) {
            console.log('✅ 数据完整性验证通过！');
        } else {
            console.log('❌ 数据完整性验证失败！');
            console.log('\n需要修复的项目：');
            if (dltCount !== redMissingCount) {
                console.log(`   ❌ 红球遗漏表: 期望${dltCount}期, 实际${redMissingCount}期`);
            }
            if (dltCount !== blueMissingCount) {
                console.log(`   ❌ 蓝球遗漏表: 期望${dltCount}期, 实际${blueMissingCount}期`);
            }
            if (dltCount !== comboFeaturesCount) {
                console.log(`   ❌ 组合特征表: 期望${dltCount}期, 实际${comboFeaturesCount}期`);
            }
            if (dltCount !== statisticsCount) {
                console.log(`   ❌ statistics字段: 期望${dltCount}期, 实际${statisticsCount}期`);
            }
            if (hwcOptimizedCount !== expectedHWCCount) {
                console.log(`   ❌ 热温冷比表: 期望${expectedHWCCount}条, 实际${hwcOptimizedCount}条`);
            }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

quickVerify();
