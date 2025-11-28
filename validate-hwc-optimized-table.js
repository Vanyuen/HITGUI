const mongoose = require('mongoose');

async function validateHwcOptimizedTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const HwcOptimized = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
        const RedCombination = mongoose.connection.db.collection('hit_dlt_redcombinations');

        // 1. 验证总记录数
        const totalRecords = await HwcOptimized.countDocuments();
        const expectedRecords = await mongoose.connection.db.collection('hit_dlts')
            .countDocuments() - 1; // 期号对比总记录数少1

        console.log('🔍 记录数验证:');
        console.log(`   实际记录数: ${totalRecords}`);
        console.log(`   预期记录数: ${expectedRecords}`);
        console.log(`   记录数匹配: ${totalRecords === expectedRecords ? '✅ 通过' : '❌ 失败'}`);

        // 2. 验证期号范围
        const earliestRecord = await HwcOptimized.findOne({}, { sort: { base_issue: 1 } });
        const latestRecord = await HwcOptimized.findOne({}, { sort: { base_issue: -1 } });

        const { min: minIssue } = await mongoose.connection.db.collection('hit_dlts')
            .findOne({}, { sort: { Issue: 1 }, projection: { Issue: 1 } });
        const { max: maxIssue } = await mongoose.connection.db.collection('hit_dlts')
            .findOne({}, { sort: { Issue: -1 }, projection: { Issue: 1 } });

        console.log('\n🔍 期号范围验证:');
        console.log(`   最早期号: ${earliestRecord.base_issue}`);
        console.log(`   最晚期号: ${latestRecord.target_issue}`);
        console.log(`   数据库期号范围: ${minIssue} - ${maxIssue}`);

        // 3. 抽样验证热温冷比数据
        const sampleRecords = await HwcOptimized.aggregate([
            { $sample: { size: 10 } }
        ]).toArray();

        console.log('\n🔍 热温冷比数据抽样验证:');
        for (const record of sampleRecords) {
            const hwcData = record.hot_warm_cold_data;
            const ratioCount = Object.keys(hwcData).length;
            const totalComboIds = Object.values(hwcData).flat();

            console.log(`\n   期号对: ${record.base_issue} → ${record.target_issue}`);
            console.log(`   热温冷比种类: ${ratioCount}`);

            // 验证组合ID的有效性
            const invalidComboIds = totalComboIds.filter(comboId =>
                comboId < 1 || comboId > 324632
            );

            console.log(`   有效组合ID数量: ${totalComboIds.length}`);
            console.log(`   无效组合ID数量: ${invalidComboIds.length}`);

            if (invalidComboIds.length > 0) {
                console.log('   ❌ 存在无效组合ID:', invalidComboIds);
            }
        }

        // 4. 验证组合总数
        const totalCombinations = await RedCombination.countDocuments();
        const recordCombinationCount = await HwcOptimized.findOne().then(
            record => record.combination_count
        );

        console.log('\n🔍 组合总数验证:');
        console.log(`   红球组合总数: ${totalCombinations}`);
        console.log(`   热温冷比记录中的组合数: ${recordCombinationCount}`);
        console.log(`   组合数匹配: ${totalCombinations === recordCombinationCount ? '✅ 通过' : '❌ 失败'}`);

        // 关闭数据库连接
        await mongoose.connection.close();

    } catch (error) {
        console.error('验证过程中发生错误:', error);
    }
}

validateHwcOptimizedTable();