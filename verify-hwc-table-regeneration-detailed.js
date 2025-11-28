const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verifyHWCTableRegeneration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        // 定义模式
        const Hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 获取主数据库信息
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssueInDb = allIssues[allIssues.length - 1].Issue;
        const nextIssue = parseInt(latestIssueInDb) + 1;

        console.log(`📊 主数据库信息:`);
        console.log(`   - 总记录数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssueInDb}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 检查热温冷比优化表
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`📊 热温冷比优化表信息:`);
        console.log(`   - 总记录数: ${hwcOptimizedCount}`);

        // 3. 详细检查记录
        const allHWCRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .sort({ target_issue: 1 })
            .toArray();

        console.log('\n🔍 记录详细信息:');
        allHWCRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        // 4. 验证记录一致性
        const expectedRecordCount = allIssues.length + 1; // 所有已开奖期 + 1个推算期
        const isCountConsistent = hwcOptimizedCount === expectedRecordCount;

        const lastRecord = allHWCRecords[allHWCRecords.length - 1];
        const isPredictedIssueCorrect =
            lastRecord &&
            parseInt(lastRecord.target_issue) === nextIssue &&
            lastRecord.is_predicted === true;

        console.log('\n✅ 一致性检查:');
        console.log(`   记录数一致性: ${isCountConsistent ? '通过' : '未通过'}`);
        console.log(`   推算期正确性: ${isPredictedIssueCorrect ? '通过' : '未通过'}`);

        await mongoose.disconnect();

        return {
            isCountConsistent,
            isPredictedIssueCorrect,
            hwcOptimizedCount,
            expectedRecordCount
        };
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyHWCTableRegeneration();