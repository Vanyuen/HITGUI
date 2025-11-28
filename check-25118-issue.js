const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 诊断25118多一期推算期问题\n');

    // 1. 检查任务的期号范围配置
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251116-2il' });

    console.log('📋 任务配置:');
    console.log(`  任务名称: ${task.task_name}`);
    console.log(`  期号范围: ${task.period_range.start} → ${task.period_range.end}`);
    console.log(`  总期数: ${task.period_range.total}`);
    console.log(`  推算期数: ${task.period_range.predicted_count}`);

    // 2. 检查任务结果
    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251116-2il' })
        .sort({ target_issue: 1 })
        .toArray();

    console.log('\n📊 任务结果:');
    console.log('期号\t\t组合数\t\tis_predicted\tbase_issue');
    console.log('─'.repeat(70));

    results.forEach(r => {
        const label = r.is_predicted ? '(推算)' : '(已开奖)';
        console.log(`${r.target_issue} ${label}\t${r.paired_combinations?.length || 0}\t\t${r.is_predicted}\t\t${r.base_issue || 'N/A'}`);
    });

    // 3. 检查数据库中25118和25119的开奖状态
    console.log('\n🎲 数据库开奖状态:');
    console.log('─'.repeat(70));

    const issues = await db.collection('hit_dlts')
        .find({ Issue: { $in: [25117, 25118, 25119, 25120, 25125] } })
        .sort({ Issue: 1 })
        .toArray();

    issues.forEach(issue => {
        const reds = [issue.Red_1, issue.Red_2, issue.Red_3, issue.Red_4, issue.Red_5];
        const blues = [issue.Blue_1, issue.Blue_2];
        console.log(`${issue.Issue}\t红球: ${reds.join(',')}\t蓝球: ${blues.join(',')}\t✅ 已开奖`);
    });

    // 4. 检查25118是否在结果中，以及为什么是0组合
    const result25118 = results.find(r => r.target_issue === '25118');

    if (result25118) {
        console.log('\n⚠️ 发现问题: 25118在结果中');
        console.log(`  is_predicted: ${result25118.is_predicted}`);
        console.log(`  base_issue: ${result25118.base_issue}`);
        console.log(`  paired_combinations: ${result25118.paired_combinations?.length || 0}`);

        // 检查热温冷优化表
        const baseIssue = result25118.base_issue || '25117';
        const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .findOne({
                base_issue: baseIssue,
                target_issue: '25118'
            });

        if (hwcData) {
            console.log(`\n✅ 找到热温冷优化数据: ${baseIssue} → 25118`);
            console.log(`  total_combinations: ${hwcData.total_combinations}`);
        } else {
            console.log(`\n❌ 未找到热温冷优化数据: ${baseIssue} → 25118`);
            console.log('  这可能是组合数为0的原因');
        }
    } else {
        console.log('\n✅ 25118不在结果中（符合预期）');
    }

    // 5. 检查任务配置的起始期号
    console.log('\n🔍 根本原因分析:');
    console.log('─'.repeat(70));

    if (task.period_range.start === '25119' && result25118) {
        console.log('❌ 问题确认: 任务配置起始期号是25119，但结果包含25118');
        console.log('');
        console.log('可能原因:');
        console.log('  1. 热温冷正选任务处理逻辑错误地多包含了base_issue');
        console.log('  2. target_issue数组计算时包含了base_issue作为第一个元素');
        console.log('  3. 期号范围解析逻辑有off-by-one错误');
        console.log('');
        console.log('💡 解决方案:');
        console.log('  检查 processHwcPositiveTask 函数中');
        console.log('  target_issues数组的构建逻辑');
        console.log('  确保不包含base_issue作为target_issue');
    } else if (!result25118) {
        console.log('✅ 无问题: 25118不在结果中');
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 连接失败:', err);
    process.exit(1);
});
