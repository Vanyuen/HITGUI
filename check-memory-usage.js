const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/hit_dlt_data', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const dltRedCombinationSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' });
const DLTRedCombination = mongoose.model('DLTRedCombination_Check', dltRedCombinationSchema);

const dltBlueCombinationSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_bluecombinations' });
const DLTBlueCombination = mongoose.model('DLTBlueCombination_Check', dltBlueCombinationSchema);

const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
const hit_dlts = mongoose.model('DLT_Check', dltSchema);

const dltComboFeaturesSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_combofeatures' });
const DLTComboFeatures = mongoose.model('DLTComboFeatures_Check', dltComboFeaturesSchema);

async function checkMemoryUsage() {
    console.log('='.repeat(80));
    console.log('📊 数据全量预加载内存占用分析');
    console.log('='.repeat(80));

    try {
        // 1. 检查红球组合表
        console.log('\n1️⃣ 红球组合表 (hit_dlt_redcombinations)');
        const redCount = await DLTRedCombination.countDocuments();
        console.log(`   总文档数: ${redCount.toLocaleString()}`);

        const redSample = await DLTRedCombination.findOne().lean();
        if (redSample) {
            const jsonStr = JSON.stringify(redSample);
            const singleSize = jsonStr.length;
            console.log(`   单个文档JSON大小: ${singleSize} bytes`);
            console.log(`   单个文档预估内存: ${(singleSize * 2)} bytes (含JS对象开销)`);

            const totalMB = (singleSize * 2 * redCount) / 1024 / 1024;
            console.log(`   🔹 全量加载预估内存: ${totalMB.toFixed(2)} MB`);

            console.log('\n   示例文档结构:');
            console.log('   ', JSON.stringify(redSample, null, 2).split('\n').slice(0, 10).join('\n    '));
        }

        // 2. 检查蓝球组合表
        console.log('\n2️⃣ 蓝球组合表 (hit_dlt_bluecombinations)');
        const blueCount = await DLTBlueCombination.countDocuments();
        console.log(`   总文档数: ${blueCount.toLocaleString()}`);

        const blueSample = await DLTBlueCombination.findOne().lean();
        if (blueSample) {
            const jsonStr = JSON.stringify(blueSample);
            const singleSize = jsonStr.length;
            const totalMB = (singleSize * 2 * blueCount) / 1024 / 1024;
            console.log(`   🔹 全量加载预估内存: ${totalMB.toFixed(2)} MB`);
        }

        // 3. 检查历史开奖表
        console.log('\n3️⃣ 历史开奖表 (hit_dlts)');
        const historyCount = await hit_dlts.countDocuments();
        console.log(`   总文档数: ${historyCount.toLocaleString()}`);

        const historySample = await hit_dlts.findOne().select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2').lean();
        if (historySample) {
            const jsonStr = JSON.stringify(historySample);
            const singleSize = jsonStr.length;
            const totalMB = (singleSize * 2 * historyCount) / 1024 / 1024;
            console.log(`   🔹 全量加载预估内存: ${totalMB.toFixed(2)} MB (仅选择必要字段)`);
        }

        // 4. 检查组合特征表
        console.log('\n4️⃣ 组合特征表 (hit_dlt_combofeatures)');
        const featuresCount = await DLTComboFeatures.countDocuments();
        console.log(`   总文档数: ${featuresCount.toLocaleString()}`);

        const featuresSample = await DLTComboFeatures.findOne().lean();
        if (featuresSample) {
            const jsonStr = JSON.stringify(featuresSample);
            const singleSize = jsonStr.length;
            const totalMB = (singleSize * 2 * featuresCount) / 1024 / 1024;
            console.log(`   🔹 全量加载预估内存: ${totalMB.toFixed(2)} MB`);
        }

        // 5. 汇总计算
        console.log('\n' + '='.repeat(80));
        console.log('📈 内存占用汇总');
        console.log('='.repeat(80));

        const redSampleSize = redSample ? JSON.stringify(redSample).length * 2 : 360;
        const redTotalMB = (redSampleSize * redCount) / 1024 / 1024;

        const blueSampleSize = blueSample ? JSON.stringify(blueSample).length * 2 : 100;
        const blueTotalMB = (blueSampleSize * blueCount) / 1024 / 1024;

        const historySampleSize = historySample ? JSON.stringify(historySample).length * 2 : 150;
        const historyTotalMB = (historySampleSize * historyCount) / 1024 / 1024;

        const featuresSampleSize = featuresSample ? JSON.stringify(featuresSample).length * 2 : 500;
        const featuresTotalMB = (featuresSampleSize * featuresCount) / 1024 / 1024;

        console.log(`红球组合表: ${redTotalMB.toFixed(2)} MB`);
        console.log(`蓝球组合表: ${blueTotalMB.toFixed(2)} MB`);
        console.log(`历史开奖表: ${historyTotalMB.toFixed(2)} MB`);
        console.log(`组合特征表: ${featuresTotalMB.toFixed(2)} MB`);
        console.log('-'.repeat(80));

        const totalMB = redTotalMB + blueTotalMB + historyTotalMB + featuresTotalMB;
        console.log(`总计预估内存: ${totalMB.toFixed(2)} MB (${(totalMB / 1024).toFixed(2)} GB)`);

        // 6. 对比当前Node.js配置
        console.log('\n' + '='.repeat(80));
        console.log('⚙️ Node.js内存配置对比');
        console.log('='.repeat(80));

        const v8 = require('v8');
        const heapStats = v8.getHeapStatistics();
        const maxHeapGB = heapStats.heap_size_limit / 1024 / 1024 / 1024;

        console.log(`当前Node.js最大堆内存: ${maxHeapGB.toFixed(2)} GB`);
        console.log(`你的物理内存: 32 GB`);
        console.log(`代码中设置的限制: 20 GB (src/server/server.js:10638)`);
        console.log(`\n预加载后内存占比:`);
        console.log(`  - 占Node.js堆: ${(totalMB / (maxHeapGB * 1024) * 100).toFixed(1)}%`);
        console.log(`  - 占代码限制: ${(totalMB / (20 * 1024) * 100).toFixed(1)}%`);
        console.log(`  - 占物理内存: ${(totalMB / (32 * 1024) * 100).toFixed(1)}%`);

        // 7. 建议
        console.log('\n' + '='.repeat(80));
        console.log('💡 优化建议');
        console.log('='.repeat(80));

        if (totalMB < 500) {
            console.log('✅ 内存占用非常合理，可以放心全量预加载');
        } else if (totalMB < 1024) {
            console.log('✅ 内存占用可接受，建议全量预加载');
        } else if (totalMB < 2048) {
            console.log('⚠️ 内存占用较大，建议按需加载或增加Node.js堆限制');
        } else {
            console.log('🔴 内存占用过大，建议分批加载或优化数据结构');
        }

        console.log(`\n当前Node.js默认堆限制为 ${maxHeapGB.toFixed(2)} GB，如需增加，启动时使用:`);
        console.log(`node --max-old-space-size=8192 src/server/server.js  (设置为8GB)`);
        console.log(`node --max-old-space-size=16384 src/server/server.js (设置为16GB)`);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

checkMemoryUsage();
