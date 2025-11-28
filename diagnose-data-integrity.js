/**
 * 诊断数据完整性问题
 * 检查"一键更新全部数据表"失败的具体原因
 */

const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');
    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);
        process.exit(1);
    }
}

// 定义模型
const hit_dltsSchema = new mongoose.Schema({
    Issue: String,
    statistics: mongoose.Schema.Types.Mixed
}, { collection: 'hit_dlts', strict: false });

const DLTComboFeaturesSchema = new mongoose.Schema({
    issue: String
}, { collection: 'hit_dlt_combofeatures', strict: false });

const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    base_issue: String,
    target_issue: String
}, { collection: 'HIT_DLT_RedCombinationsHotWarmColdOptimized', strict: false });

const hit_dlts = mongoose.model('hit_dlts_temp', hit_dltsSchema);
const DLTComboFeatures = mongoose.model('DLTComboFeatures_temp', DLTComboFeaturesSchema);
const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('DLTRedCombinationsHotWarmColdOptimized_temp', DLTRedCombinationsHotWarmColdOptimizedSchema);

async function diagnose() {
    await connectDB();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔍 数据完整性诊断报告');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. 获取基础数据统计
        const dltCount = await hit_dlts.countDocuments();
        const dltLatest = await hit_dlts.findOne({}).sort({ Issue: -1 });

        console.log(`📊 基础数据:`);
        console.log(`   hit_dlts 总期数: ${dltCount}`);
        console.log(`   最新期号: ${dltLatest?.Issue || 'N/A'}\n`);

        // 2. 检查红球遗漏表
        const redMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        console.log(`🔴 红球遗漏表 (hit_dlt_basictrendchart_redballmissing_histories):`);
        console.log(`   期数: ${redMissingCount}`);
        console.log(`   状态: ${dltCount === redMissingCount ? '✅ 正常' : `❌ 不一致 (期望${dltCount}期)`}\n`);

        // 3. 检查蓝球遗漏表 (注意原代码有bug，这里修复)
        let blueMissingCount;
        const blueCollectionExists = await mongoose.connection.db.listCollections({ name: 'hit_dlt_basictrendchart_blueballmissing_histories' }).hasNext();

        if (blueCollectionExists) {
            blueMissingCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_blueballmissing_histories').countDocuments();
        } else {
            console.log(`⚠️  蓝球遗漏表集合不存在，使用 hit_dlts 作为替代`);
            blueMissingCount = await hit_dlts.countDocuments();
        }

        console.log(`🔵 蓝球遗漏表:`);
        console.log(`   期数: ${blueMissingCount}`);
        console.log(`   状态: ${dltCount === blueMissingCount ? '✅ 正常' : `❌ 不一致 (期望${dltCount}期)`}\n`);

        // 4. 检查组合特征表
        const comboFeaturesCount = await DLTComboFeatures.countDocuments();
        console.log(`📊 组合特征表 (hit_dlt_combofeatures):`);
        console.log(`   期数: ${comboFeaturesCount}`);
        console.log(`   状态: ${dltCount === comboFeaturesCount ? '✅ 正常' : `❌ 不一致 (期望${dltCount}期)`}\n`);

        // 5. 检查statistics字段
        const statisticsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });
        const statisticsNullCount = await hit_dlts.countDocuments({ statistics: { $exists: true, $eq: null } });
        const statisticsValidCount = await hit_dlts.countDocuments({
            statistics: { $exists: true, $ne: null, $type: 'object' }
        });

        console.log(`📈 statistics字段:`);
        console.log(`   有statistics字段的期数: ${statisticsCount}`);
        console.log(`   其中为null的: ${statisticsNullCount}`);
        console.log(`   其中有效对象的: ${statisticsValidCount}`);
        console.log(`   状态: ${dltCount === statisticsCount ? '✅ 正常' : `❌ 不一致 (期望${dltCount}期)`}\n`);

        // 6. 检查热温冷比优化表
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        const expectedHWCCount = dltCount > 0 ? dltCount : 0;

        // 获取热温冷比优化表的唯一期号对
        const hwcIssuePairs = await DLTRedCombinationsHotWarmColdOptimized.distinct('base_issue');

        console.log(`🔥 热温冷比优化表 (HIT_DLT_RedCombinationsHotWarmColdOptimized):`);
        console.log(`   总记录数: ${hwcOptimizedCount}`);
        console.log(`   唯一base_issue数: ${hwcIssuePairs.length}`);
        console.log(`   期望记录数: ${expectedHWCCount} (已开奖期数)`);
        console.log(`   状态: ${hwcOptimizedCount === expectedHWCCount ? '✅ 正常' : `❌ 不一致`}\n`);

        // 7. 综合判断
        const allComplete =
            dltCount === redMissingCount &&
            dltCount === blueMissingCount &&
            dltCount === comboFeaturesCount &&
            dltCount === statisticsCount &&
            hwcOptimizedCount === expectedHWCCount;

        console.log('═══════════════════════════════════════════════════════════════');
        if (allComplete) {
            console.log('✅ 数据完整性验证通过！');
        } else {
            console.log('❌ 数据完整性验证失败！');
            console.log('\n需要修复的项目:');
            if (dltCount !== redMissingCount) {
                console.log(`   ❌ 红球遗漏表: 缺少 ${Math.abs(dltCount - redMissingCount)} 期`);
            }
            if (dltCount !== blueMissingCount) {
                console.log(`   ❌ 蓝球遗漏表: 缺少 ${Math.abs(dltCount - blueMissingCount)} 期`);
            }
            if (dltCount !== comboFeaturesCount) {
                console.log(`   ❌ 组合特征表: 缺少 ${Math.abs(dltCount - comboFeaturesCount)} 期`);
            }
            if (dltCount !== statisticsCount) {
                console.log(`   ❌ statistics字段: 缺少 ${Math.abs(dltCount - statisticsCount)} 期`);
            }
            if (hwcOptimizedCount !== expectedHWCCount) {
                console.log(`   ❌ 热温冷比表: 差异 ${Math.abs(hwcOptimizedCount - expectedHWCCount)} 条记录`);
            }
        }
        console.log('═══════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');
    }
}

diagnose();
