const mongoose = require('mongoose');

async function diagnoseHwcOptimizedTable() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 检查热温冷比优化表集合
        const hwcOptimizedCollection = mongoose.connection.db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

        // 统计总记录数
        const totalRecords = await hwcOptimizedCollection.countDocuments();
        console.log(`热温冷比优化表总记录数: ${totalRecords}`);

        // 查看最早和最晚的期号记录
        const earliestRecord = await hwcOptimizedCollection.findOne({}, { sort: { base_issue: 1 }, projection: { base_issue: 1, target_issue: 1, generated_at: 1 } });
        const latestRecord = await hwcOptimizedCollection.findOne({}, { sort: { base_issue: -1 }, projection: { base_issue: 1, target_issue: 1, generated_at: 1 } });

        console.log('最早的期号对:');
        console.log(earliestRecord);

        console.log('\n最晚的期号对:');
        console.log(latestRecord);

        // 检查生成时间
        const oldestGenerationTime = earliestRecord?.generated_at;
        const newestGenerationTime = latestRecord?.generated_at;

        console.log('\n生成时间:');
        console.log(`最早生成时间: ${oldestGenerationTime}`);
        console.log(`最新生成时间: ${newestGenerationTime}`);

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    }
}

diagnoseHwcOptimizedTable();