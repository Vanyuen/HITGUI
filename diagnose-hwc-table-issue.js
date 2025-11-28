const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnoseHWCTableIssue() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const Hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取最新数据
        const latestIssue = await Hit_dlts.findOne({}, { sort: { ID: -1 } });
        const totalIssuesCount = await Hit_dlts.countDocuments();
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('🔍 主数据库信息:');
        console.log(`   - 总记录数: ${totalIssuesCount}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        console.log('📊 热温冷比优化表诊断:');

        // 获取所有记录，按目标期排序
        const allHWCRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .sort({ target_issue: 1 })
            .toArray();

        console.log(`   - 总记录数: ${allHWCRecords.length}`);

        console.log('\n🕵️ 记录详细信息:');
        allHWCRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        // 检查最后10条记录
        console.log('\n📋 最后10条记录:');
        const last10Records = allHWCRecords.slice(-10);
        last10Records.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnoseHWCTableIssue();