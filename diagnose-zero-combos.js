const mongoose = require('mongoose');

async function diagnoseIssue() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 1. 查看最近一个任务的详细信息
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    if (!task) {
        console.log('没有找到任务');
        await mongoose.disconnect();
        return;
    }

    console.log('=== 最近任务信息 ===');
    console.log('task_id:', task.task_id);
    console.log('period_range:', JSON.stringify(task.period_range));
    console.log('positive_selection热温冷比:', JSON.stringify(task.positive_selection?.red_hot_warm_cold_ratios));

    // 2. 查看该任务的结果记录
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .sort({ target_issue: 1 })
        .limit(35)
        .toArray();

    console.log('\n=== 结果记录分析 ===');
    console.log('结果总数:', results.length);

    // 区分有组合和无组合的期号
    const withCombos = results.filter(r => r.red_combinations && r.red_combinations.length > 0);
    const withoutCombos = results.filter(r => !r.red_combinations || r.red_combinations.length === 0);

    console.log('有组合的期号数:', withCombos.length);
    console.log('无组合的期号数:', withoutCombos.length);

    // 显示有组合的期号
    if (withCombos.length > 0) {
        console.log('\n有组合的期号:');
        withCombos.forEach(r => {
            console.log('  ' + r.target_issue + ': ' + (r.red_combinations?.length || 0) + '个组合, is_predicted=' + r.is_predicted);
        });
    }

    // 显示部分无组合的期号及其详情
    if (withoutCombos.length > 0) {
        console.log('\n无组合期号样例 (前5个):');
        withoutCombos.slice(0, 5).forEach(r => {
            console.log('  期号:', r.target_issue);
            console.log('    base_issue:', r.base_issue);
            console.log('    is_predicted:', r.is_predicted);
            console.log('    positive_selection_details:', JSON.stringify(r.positive_selection_details));
            console.log('    error:', r.error);
        });
    }

    // 3. 验证热温冷数据
    console.log('\n=== 验证热温冷数据 ===');

    // 获取一个无组合期号的期号对
    if (withoutCombos.length > 0) {
        const sample = withoutCombos[0];
        if (sample.base_issue && sample.target_issue) {
            const hwcData = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({
                    base_issue: sample.base_issue,
                    target_issue: sample.target_issue
                });

            console.log('查找期号对:', sample.base_issue, '->', sample.target_issue);
            if (hwcData) {
                console.log('热温冷数据存在!');
                console.log('  热温冷比数量:', Object.keys(hwcData.hot_warm_cold_data || {}).length);
                const ratio410 = hwcData.hot_warm_cold_data?.['4:1:0'];
                console.log('  4:1:0组合数:', ratio410?.length || '无');
            } else {
                console.log('❌ 热温冷数据不存在!');
            }
        }
    }

    // 4. 检查预加载数据
    console.log('\n=== 检查期号范围数据 ===');

    // 获取任务期号范围
    const startIssue = parseInt(task.period_range?.start || '25095');
    const endIssue = parseInt(task.period_range?.end || '25125');

    console.log('任务期号范围:', startIssue, '-', endIssue);

    // 查询数据库中的期号记录
    const issueRecords = await mongoose.connection.db.collection('hit_dlts')
        .find({ Issue: { $gte: startIssue, $lte: endIssue } })
        .sort({ Issue: 1 })
        .toArray();

    console.log('数据库中实际存在的期号数:', issueRecords.length);
    if (issueRecords.length > 0) {
        console.log('最大期号:', issueRecords[issueRecords.length - 1]?.Issue);
    }

    // 检查期号连续性
    const firstRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: startIssue });

    if (firstRecord) {
        console.log('\n首个期号ID信息:');
        console.log('  Issue:', firstRecord.Issue, ', ID:', firstRecord.ID);

        // 查上一期
        const prevRecord = await mongoose.connection.db.collection('hit_dlts')
            .findOne({ ID: firstRecord.ID - 1 });

        if (prevRecord) {
            console.log('  上一期(ID-1):', prevRecord.Issue, ', ID:', prevRecord.ID);
        }
    }

    // 5. 检查有组合期号的详细信息
    if (withCombos.length > 0) {
        console.log('\n=== 有组合期号的详细分析 ===');
        const sampleWithCombo = withCombos[0];
        console.log('期号:', sampleWithCombo.target_issue);
        console.log('base_issue:', sampleWithCombo.base_issue);
        console.log('is_predicted:', sampleWithCombo.is_predicted);
        console.log('positive_selection_details:', JSON.stringify(sampleWithCombo.positive_selection_details));

        // 验证该期号对的热温冷数据
        if (sampleWithCombo.base_issue && sampleWithCombo.target_issue) {
            const hwcData = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({
                    base_issue: sampleWithCombo.base_issue,
                    target_issue: sampleWithCombo.target_issue
                });

            console.log('热温冷数据查询:', sampleWithCombo.base_issue, '->', sampleWithCombo.target_issue);
            if (hwcData) {
                console.log('  热温冷数据存在!');
                const ratio410 = hwcData.hot_warm_cold_data?.['4:1:0'];
                console.log('  4:1:0组合数:', ratio410?.length || '无');
            } else {
                console.log('  ❌ 热温冷数据不存在!');
            }
        }
    }

    await mongoose.disconnect();
}

diagnoseIssue().catch(console.error);
