const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verifyHWCOptimizedTableUpdate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取所有已开奖期号
        const allIssues = await hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssueInDb = parseInt(allIssues[allIssues.length - 1].Issue);
        console.log(`📊 主数据库最新期号: ${latestIssueInDb}`);
        console.log(`📊 总开奖记录数: ${allIssues.length}`);

        // 检查热温冷比优化表
        const hwcOptimizedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`📊 热温冷比优化表记录数: ${hwcOptimizedCount}`);

        // 查看最近的记录
        const latestHWCRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .sort({ target_issue: -1 })
            .limit(10)
            .toArray();

        console.log('\n🔍 最近的热温冷比优化记录:');
        latestHWCRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否已开奖: ${record.hit_analysis?.is_drawn}`);
        });

        // 检查是否覆盖了最新期号
        const maxTargetIssueInHWC = Math.max(...latestHWCRecords.map(r => parseInt(r.target_issue)));
        console.log(`\n📊 热温冷比优化表最新目标期: ${maxTargetIssueInHWC}`);

        // 验证一致性
        const isConsistent = maxTargetIssueInHWC >= latestIssueInDb;
        console.log(`\n✅ 数据一致性: ${isConsistent ? '通过' : '未通过'}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyHWCOptimizedTableUpdate();