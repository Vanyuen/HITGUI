const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 深度诊断期号范围问题\n');

    // 1. 查找最新的热温冷正选任务
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    if (!task) {
        console.log('❌ 未找到任何热温冷正选任务');
        return;
    }

    console.log('📋 最新任务配置:');
    console.log('  任务ID:', task.task_id);
    console.log('  期号范围配置:');
    console.log('    类型:', task.period_range.type);
    console.log('    起始期号:', task.period_range.start);
    console.log('    结束期号:', task.period_range.end);
    console.log('    总期数:', task.period_range.total);
    console.log('    预测期数:', task.period_range.predicted_count || 0);

    // 2. 详细调查hit_dlts集合
    console.log('\n🔍 hit_dlts集合调查:');
    const dltRecords = await db.collection('hit_dlts')
        .find({Issue: {$gte: 25110, $lte: 25130}})
        .sort({Issue: 1})
        .toArray();

    console.log('数据库中连续的期号:');
    dltRecords.forEach(record => {
        console.log(`期号: ${record.Issue}, ID: ${record.ID}`);
    });

    // 3. 对比期号范围和结果集
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .sort({ period: 1 })
        .toArray();

    console.log('\n📊 任务结果详情:');
    console.log('期号\t组合数\t\tis_predicted');
    console.log('─'.repeat(50));

    results.forEach(result => {
        console.log(
            `${result.period}\t` +
            `${result.paired_combinations?.length || 0}\t\t` +
            `${result.is_predicted}`
        );
    });

    // 4. 检查 resolveIssueRangeInternal 调用链
    console.log('\n🕵️ 期号范围解析诊断:');
    const recentData = await db.collection('hit_dlts')
        .find({})
        .sort({ Issue: -1 })
        .limit(task.period_range.total - 1)  // 减1为留出推算期
        .toArray();

    console.log('\n最近期数据 (按ID降序):');
    recentData.forEach(record => {
        console.log(`期号: ${record.Issue}, ID: ${record.ID}`);
    });

    const distinctIssues = [...new Set(results.map(r => r.period))].sort();
    console.log('\n结果期号范围:');
    console.log(`  首个期号: ${distinctIssues[0]}`);
    console.log(`  最后期号: ${distinctIssues[distinctIssues.length - 1]}`);
    console.log(`  总期数: ${distinctIssues.length}`);

    await mongoose.connection.close();
}).catch(console.error);