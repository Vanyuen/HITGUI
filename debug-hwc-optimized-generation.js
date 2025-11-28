const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function debugHWCTableGeneration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取所有已开奖期号
        const allIssues = await hit_dlts.find({}).sort({ ID: 1 }).toArray();
        console.log(`📊 找到 ${allIssues.length} 期已开奖数据`);
        const latestIssueInDb = parseInt(allIssues[allIssues.length - 1].Issue);
        console.log(`📊 最新期号: ${latestIssueInDb}`);

        // 查找最后一个优化表记录
        const lastOptimizedRecord = await DLTRedCombinationsHotWarmColdOptimized
            .find({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .limit(1)
            .toArray();

        console.log('\n🔍 最后一个热温冷优化记录:');
        if (lastOptimizedRecord.length > 0) {
            console.log(`- 目标期号: ${lastOptimizedRecord[0].target_issue}`);
            console.log(`- 基准期号: ${lastOptimizedRecord[0].base_issue}`);
            console.log(`- 是否已开奖: ${lastOptimizedRecord[0].hit_analysis.is_drawn}`);
        } else {
            console.log('❌ 未找到任何已开奖记录');
        }

        // 检查处理条件
        const processConditions = allIssues.filter(issue =>
            lastOptimizedRecord.length === 0 ||
            parseInt(issue.Issue) > parseInt(lastOptimizedRecord[0].target_issue)
        );

        console.log('\n📊 待处理期号:');
        processConditions.slice(-10).forEach(issue => {
            console.log(`- 期号: ${issue.Issue}, ID: ${issue.ID}`);
        });
        console.log(`总共 ${processConditions.length} 个待处理期号`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugHWCTableGeneration();