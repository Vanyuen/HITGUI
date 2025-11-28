const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verifyHWCTableRegeneration() {
    try {
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000
        });
        console.log('✅ 已连接到数据库\n');

        // 定义模式
        const Hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 获取主数据库信息
        const latestIssue = await Hit_dlts.findOne({}, { sort: { ID: -1 } });
        const totalIssuesCount = await Hit_dlts.countDocuments();
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log(`📊 主数据库信息:`);
        console.log(`   - 总记录数: ${totalIssuesCount}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 检查热温冷比优化表
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`📊 热温冷比优化表信息:`);
        console.log(`   - 总记录数: ${hwcOptimizedCount}`);

        // 3. 查找最后一条记录
        const lastHWCRecord = await DLTRedCombinationsHotWarmColdOptimized
            .findOne({}, { sort: { target_issue: -1 } });

        console.log('\n🔍 最后一条记录:');
        if (lastHWCRecord) {
            console.log(`  基准期: ${lastHWCRecord.base_issue}`);
            console.log(`  目标期: ${lastHWCRecord.target_issue}`);
            console.log(`  是否为预测期: ${lastHWCRecord.is_predicted}`);
        } else {
            console.log('❌ 未找到任何记录');
        }

        // 4. 验证记录一致性
        const expectedRecordCount = totalIssuesCount + 1; // 所有已开奖期 + 1个推算期
        const isCountConsistent = hwcOptimizedCount === expectedRecordCount;

        const isPredictedIssueCorrect =
            lastHWCRecord &&
            parseInt(lastHWCRecord.target_issue) === nextIssue &&
            lastHWCRecord.is_predicted === true;

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