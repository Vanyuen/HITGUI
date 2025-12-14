/**
 * 诊断所有数据为0的问题
 * 模拟完整的预加载和处理流程
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('已连接数据库');

    const db = mongoose.connection.db;

    // 1. 获取最新任务的配置
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251212-0fc' });

    console.log('\n=== 任务配置 ===');
    console.log('task_id:', task.task_id);
    console.log('period_range:', JSON.stringify(task.period_range));
    console.log('positive_selection.red_hot_warm_cold_ratios:',
        JSON.stringify(task.positive_selection?.red_hot_warm_cold_ratios));

    // 2. 模拟resolveIssueRange
    const startIssue = parseInt(task.period_range?.start || '25034');
    const endIssue = parseInt(task.period_range?.end || '25142');
    const totalCount = task.period_range?.total || 109;

    console.log('\n=== 模拟resolveIssueRange ===');
    console.log('start:', startIssue, 'end:', endIssue, 'total:', totalCount);

    // 3. 检查数据库中的期号
    const allIssues = await db.collection('hit_dlts')
        .find({ Issue: { $gte: startIssue - 1, $lte: endIssue } })
        .project({ Issue: 1, ID: 1 })
        .sort({ Issue: 1 })
        .toArray();

    console.log('\n=== 数据库中的期号 ===');
    console.log('找到的记录数:', allIssues.length);
    console.log('最小期号:', allIssues[0]?.Issue, 'ID:', allIssues[0]?.ID);
    console.log('最大期号:', allIssues[allIssues.length - 1]?.Issue,
        'ID:', allIssues[allIssues.length - 1]?.ID);

    // 4. 模拟preloadData逻辑 - 生成期号对
    const issueNumbers = [];
    for (let i = 0; i < totalCount; i++) {
        // 简化：使用数据库中按顺序的期号
        if (i < allIssues.length) {
            issueNumbers.push(allIssues[i].Issue);
        }
    }
    // 添加推算期25142（如果不在数据库中）
    const maxDbIssue = allIssues[allIssues.length - 1]?.Issue;
    if (maxDbIssue < endIssue) {
        issueNumbers.push(endIssue);
    }

    console.log('\n=== 目标期号列表 ===');
    console.log('总数:', issueNumbers.length);
    console.log('前5个:', issueNumbers.slice(0, 5).join(', '));
    console.log('后5个:', issueNumbers.slice(-5).join(', '));

    // 5. 生成期号对
    const issuePairs = [];
    const idToRecordMap = new Map(allIssues.map(r => [r.ID, r]));
    const issueToIdMap = new Map(allIssues.map(r => [r.Issue, r.ID]));

    for (const issue of issueNumbers) {
        const id = issueToIdMap.get(issue);
        if (id) {
            const baseRecord = idToRecordMap.get(id - 1);
            if (baseRecord) {
                issuePairs.push({
                    base_issue: baseRecord.Issue.toString(),
                    target_issue: issue.toString()
                });
            }
        } else {
            // 推算期 - 使用最大期号作为基准
            issuePairs.push({
                base_issue: maxDbIssue.toString(),
                target_issue: issue.toString()
            });
        }
    }

    console.log('\n=== 生成的期号对 ===');
    console.log('总数:', issuePairs.length);
    console.log('前3个:', JSON.stringify(issuePairs.slice(0, 3)));
    console.log('后3个:', JSON.stringify(issuePairs.slice(-3)));

    // 6. 检查HWC优化表
    console.log('\n=== 检查HWC优化表数据 ===');

    // 检查第一个期号对
    const firstPair = issuePairs[0];
    console.log('查询第一个期号对:', firstPair.base_issue, '->', firstPair.target_issue);

    const hwc1 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({
            base_issue: firstPair.base_issue,
            target_issue: firstPair.target_issue
        });

    if (hwc1) {
        console.log('  存在! ratio种类:', Object.keys(hwc1.hot_warm_cold_data || {}).length);
        const ratio311 = hwc1.hot_warm_cold_data?.['3:1:1'];
        console.log('  3:1:1 组合数:', ratio311?.length || 0);
    } else {
        console.log('  不存在!');

        // 尝试数字类型
        const hwc1Num = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .findOne({
                base_issue: parseInt(firstPair.base_issue),
                target_issue: parseInt(firstPair.target_issue)
            });
        console.log('  尝试数字类型查询:', hwc1Num ? '存在' : '不存在');
    }

    // 检查最后一个期号对（推算期）
    const lastPair = issuePairs[issuePairs.length - 1];
    console.log('\n查询最后一个期号对（推算期）:', lastPair.base_issue, '->', lastPair.target_issue);

    const hwc2 = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({
            base_issue: lastPair.base_issue,
            target_issue: lastPair.target_issue
        });

    if (hwc2) {
        console.log('  存在! ratio种类:', Object.keys(hwc2.hot_warm_cold_data || {}).length);
        const ratio311 = hwc2.hot_warm_cold_data?.['3:1:1'];
        console.log('  3:1:1 组合数:', ratio311?.length || 0);
    } else {
        console.log('  不存在!');
    }

    // 7. 批量查询所有期号对
    console.log('\n=== 批量查询HWC数据 ===');
    const orQuery = issuePairs.map(p => ({
        base_issue: p.base_issue,
        target_issue: p.target_issue
    }));

    const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({ $or: orQuery })
        .toArray();

    console.log('查询到的HWC记录数:', hwcDataList.length);
    console.log('期望的记录数:', issuePairs.length);
    console.log('缺失数:', issuePairs.length - hwcDataList.length);

    if (hwcDataList.length > 0) {
        console.log('\n第一条HWC记录:');
        const first = hwcDataList[0];
        console.log('  base_issue:', first.base_issue, '类型:', typeof first.base_issue);
        console.log('  target_issue:', first.target_issue, '类型:', typeof first.target_issue);
        console.log('  hot_warm_cold_data存在:', !!first.hot_warm_cold_data);
    }

    // 8. 检查HWC表中期号的类型
    console.log('\n=== HWC表字段类型检查 ===');
    const sampleHwc = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({});
    if (sampleHwc) {
        console.log('base_issue 类型:', typeof sampleHwc.base_issue, '值:', sampleHwc.base_issue);
        console.log('target_issue 类型:', typeof sampleHwc.target_issue, '值:', sampleHwc.target_issue);
    }

    // 9. 检查数字类型查询
    console.log('\n=== 数字类型查询测试 ===');
    const numQuery = issuePairs.slice(0, 5).map(p => ({
        base_issue: parseInt(p.base_issue),
        target_issue: parseInt(p.target_issue)
    }));

    const hwcNumResult = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({ $or: numQuery })
        .toArray();
    console.log('数字类型查询结果数:', hwcNumResult.length, '/ 5');

    await mongoose.disconnect();
    console.log('\n诊断完成');
}

diagnose().catch(e => { console.error(e); process.exit(1); });
