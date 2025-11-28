/**
 * 测试验证函数是否能正常执行
 */

const mongoose = require('mongoose');

async function testVerifyFunction() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_test', hit_dltsSchema);

        const DLTComboFeaturesSchema = new mongoose.Schema({}, { collection: 'hit_dlt_combofeatures', strict: false });
        const DLTComboFeatures = mongoose.model('DLTComboFeatures_test', DLTComboFeaturesSchema);

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HWCTest', DLTRedCombinationsHotWarmColdOptimizedSchema);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🧪 模拟验证函数执行（完全按照server.js:29335-29391）');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const startTime = Date.now();

        console.log('步骤1/7: 查询 hit_dlts 记录数...');
        const dltCount = await hit_dlts.countDocuments();
        console.log(`   ✅ dltCount = ${dltCount}\n`);

        console.log('步骤2/7: 查询最新期号...');
        const dltLatest = await hit_dlts.findOne({}).sort({ Issue: -1 });
        console.log(`   ✅ dltLatest.Issue = ${dltLatest?.Issue}\n`);

        console.log('步骤3/7: 查询红球遗漏记录数...');
        const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        console.log(`   ✅ redMissingCount = ${redMissingCount}\n`);

        console.log('步骤4/7: 查询蓝球遗漏记录数...');
        const blueMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
        console.log(`   ✅ blueMissingCount = ${blueMissingCount}\n`);

        console.log('步骤5/7: 查询组合特征记录数...');
        const comboFeaturesCount = await DLTComboFeatures.countDocuments();
        console.log(`   ✅ comboFeaturesCount = ${comboFeaturesCount}\n`);

        console.log('步骤6/7: 查询热温冷比优化表记录数...');
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`   ✅ hwcOptimizedCount = ${hwcOptimizedCount}\n`);

        console.log('步骤7/7: 查询statistics字段...');
        const statisticsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });
        console.log(`   ✅ statisticsCount = ${statisticsCount}\n`);

        const queryTime = Date.now() - startTime;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 验证数据');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`   hit_dlts: ${dltCount} 期，最新期号 ${dltLatest?.Issue}`);
        console.log(`   红球遗漏: ${redMissingCount} 期`);
        console.log(`   蓝球遗漏: ${blueMissingCount} 期`);
        console.log(`   组合特征: ${comboFeaturesCount} 期`);
        console.log(`   热温冷比: ${hwcOptimizedCount} 条`);
        console.log(`   statistics字段: ${statisticsCount} 期\n`);

        // 按照server.js:29359的逻辑
        const expectedHWCCount = dltCount > 0 ? dltCount : 0;

        const allComplete =
            dltCount === redMissingCount &&
            dltCount === blueMissingCount &&
            dltCount === comboFeaturesCount &&
            dltCount === statisticsCount &&
            hwcOptimizedCount === expectedHWCCount;

        console.log(`验证逻辑:`);
        console.log(`   dltCount === redMissingCount: ${dltCount === redMissingCount} (${dltCount} === ${redMissingCount})`);
        console.log(`   dltCount === blueMissingCount: ${dltCount === blueMissingCount} (${dltCount} === ${blueMissingCount})`);
        console.log(`   dltCount === comboFeaturesCount: ${dltCount === comboFeaturesCount} (${dltCount} === ${comboFeaturesCount})`);
        console.log(`   dltCount === statisticsCount: ${dltCount === statisticsCount} (${dltCount} === ${statisticsCount})`);
        console.log(`   hwcOptimizedCount === expectedHWCCount: ${hwcOptimizedCount === expectedHWCCount} (${hwcOptimizedCount} === ${expectedHWCCount})\n`);

        if (allComplete) {
            console.log('✅ 数据完整性验证通过！');
            console.log(`   函数应该返回: true`);
        } else {
            console.log('❌ 数据完整性验证失败！');
            console.log(`   函数应该返回: false`);
        }

        console.log(`\n⏱️  查询耗时: ${queryTime}ms`);
        console.log(`\n🎯 结论: 验证函数${allComplete ? '✅ 应该正常通过' : '❌ 会返回失败'}\n`);

        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error('   错误堆栈:', error.stack);
        process.exit(1);
    }
}

testVerifyFunction();
