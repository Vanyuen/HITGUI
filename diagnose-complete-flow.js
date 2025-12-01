const mongoose = require('mongoose');

async function diagnoseCompleteFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 完整处理流程诊断 ===\n');

    // 模拟targetIssues (最近30期 + 推算期)
    const targetIssues = [];
    for (let i = 25095; i <= 25125; i++) {
        targetIssues.push(String(i));
    }
    console.log('目标期号数量:', targetIssues.length);
    console.log('期号范围:', targetIssues[0], '-', targetIssues[targetIssues.length - 1]);

    // =============================================
    // 步骤1: 模拟 preloadData 的期号对生成
    // =============================================
    console.log('\n=== 步骤1: 模拟preloadData ===');

    const issueNumbers = targetIssues.map(i => parseInt(i));
    const firstIssueNum = issueNumbers[0];

    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    console.log('第一个期号记录:', firstIssueRecord?.Issue, 'ID:', firstIssueRecord?.ID);

    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
    console.log('allIssueNums 长度:', allIssueNums.length);

    const allRecords = await mongoose.connection.db.collection('hit_dlts')
        .find({
            $or: [
                { ID: { $in: allIssueNums } },
                { Issue: { $in: issueNumbers } }
            ]
        })
        .sort({ ID: 1 })
        .toArray();

    console.log('查询到的记录数:', allRecords.length);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }
    console.log('idToRecordMap 大小:', idToRecordMap.size);
    console.log('issueToIdMap 大小:', issueToIdMap.size);

    // 检查25125是否在issueToIdMap中
    console.log('\n25124 在 issueToIdMap 中?', issueToIdMap.has('25124'), '-> ID:', issueToIdMap.get('25124'));
    console.log('25125 在 issueToIdMap 中?', issueToIdMap.has('25125'), '-> ID:', issueToIdMap.get('25125'));

    // 生成期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\nissueRecords 数量 (数据库中存在的期号):', issueRecords.length);

    const issuePairs = [];
    for (const record of issueRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: targetIssue
            });
        }
    }
    console.log('生成的期号对数量:', issuePairs.length);

    // 检查25125的期号对是否存在
    const pair25125 = issuePairs.find(p => p.target_issue === '25125');
    console.log('25124→25125 期号对存在?', !!pair25125);

    // =============================================
    // 步骤2: 检查HWC缓存加载
    // =============================================
    console.log('\n=== 步骤2: 检查HWC数据预加载 ===');

    // 模拟preloadHwcOptimizedData
    const hwcDataList = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

    console.log('从数据库加载的HWC数据数量:', hwcDataList.length);

    // 模拟构建hwcOptimizedCache
    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = `${data.base_issue}-${data.target_issue}`;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
        }
    }
    console.log('hwcOptimizedCache 大小:', hwcOptimizedCache.size);

    // 检查缓存中的特定期号对
    console.log('\n检查缓存中的期号对:');
    console.log('  25094-25095:', hwcOptimizedCache.has('25094-25095') ? '✅ 存在' : '❌ 不存在');
    console.log('  25123-25124:', hwcOptimizedCache.has('25123-25124') ? '✅ 存在' : '❌ 不存在');
    console.log('  25124-25125:', hwcOptimizedCache.has('25124-25125') ? '✅ 存在' : '❌ 不存在');

    // =============================================
    // 步骤3: 模拟processBatch的处理
    // =============================================
    console.log('\n=== 步骤3: 模拟processBatch ===');

    // 检查firstIssuePreviousRecord是否正确设置
    let firstIssuePreviousRecord = null;
    if (issuePairs.length > 0) {
        const firstPair = issuePairs[0];
        const baseIssueNum = parseInt(firstPair.base_issue);
        const baseRecord = allRecords.find(r => r.Issue === baseIssueNum);
        if (baseRecord) {
            firstIssuePreviousRecord = {
                issue: firstPair.base_issue,
                id: baseRecord.ID
            };
        }
    }
    console.log('firstIssuePreviousRecord:', firstIssuePreviousRecord);

    // 模拟issueToIDArray构建
    const issueToIDArray = targetIssues.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        return { issue: issueStr, id: id || null, index };
    });

    console.log('\nissueToIDArray 样例 (前3个和最后2个):');
    issueToIDArray.slice(0, 3).forEach(item => {
        console.log(`  Issue ${item.issue}: ID = ${item.id}`);
    });
    console.log('  ...');
    issueToIDArray.slice(-2).forEach(item => {
        console.log(`  Issue ${item.issue}: ID = ${item.id}`);
    });

    // =============================================
    // 步骤4: 模拟每个期号的处理
    // =============================================
    console.log('\n=== 步骤4: 模拟每个期号的baseIssue获取 ===');

    const results = [];

    for (let i = 0; i < issueToIDArray.length; i++) {
        const { issue: targetIssue, id: targetID } = issueToIDArray[i];

        let baseIssue, baseID;
        let method = '';

        if (i === 0) {
            if (firstIssuePreviousRecord) {
                baseIssue = firstIssuePreviousRecord.issue;
                baseID = firstIssuePreviousRecord.id;
                method = 'firstIssuePreviousRecord';
            } else {
                baseIssue = null;
                method = 'SKIPPED (no previous)';
            }
        } else {
            // 使用ID-1规则
            const baseRecord = idToRecordMap.get(targetID - 1);

            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                baseID = baseRecord.ID;
                method = 'ID-1 rule';
            } else if (targetID === null) {
                // ⚠️ 这里是关键问题！
                // 如果targetID为null（推算期），则ID-1也无法工作
                baseIssue = issueToIDArray[i - 1].issue;
                baseID = issueToIDArray[i - 1].id;
                method = 'array fallback (targetID is null)';
            } else {
                baseIssue = issueToIDArray[i - 1].issue;
                baseID = issueToIDArray[i - 1].id;
                method = 'array fallback';
            }
        }

        // 检查hwcCache
        const hwcKey = baseIssue ? `${baseIssue}-${targetIssue}` : 'N/A';
        const hasHwcData = baseIssue ? hwcOptimizedCache.has(hwcKey) : false;

        results.push({
            index: i,
            targetIssue,
            targetID,
            baseIssue,
            baseID,
            method,
            hwcKey,
            hasHwcData
        });
    }

    // 显示前5个和最后3个结果
    console.log('\n处理结果 (前5个):');
    results.slice(0, 5).forEach(r => {
        console.log(`  [${r.index}] ${r.targetIssue}: base=${r.baseIssue}, hwcKey=${r.hwcKey}, hasHwc=${r.hasHwcData ? '✅' : '❌'} [${r.method}]`);
    });

    console.log('\n处理结果 (最后3个):');
    results.slice(-3).forEach(r => {
        console.log(`  [${r.index}] ${r.targetIssue}: base=${r.baseIssue}, hwcKey=${r.hwcKey}, hasHwc=${r.hasHwcData ? '✅' : '❌'} [${r.method}]`);
    });

    // 统计
    const withHwc = results.filter(r => r.hasHwcData);
    const withoutHwc = results.filter(r => !r.hasHwcData);
    console.log('\n=== 统计 ===');
    console.log('有HWC缓存的期号:', withHwc.length);
    console.log('无HWC缓存的期号:', withoutHwc.length);

    console.log('\n无HWC缓存的期号详情:');
    withoutHwc.forEach(r => {
        console.log(`  ${r.targetIssue}: targetID=${r.targetID}, hwcKey=${r.hwcKey}, method=${r.method}`);
    });

    // =============================================
    // 步骤5: 检查推算期25125的特殊处理
    // =============================================
    console.log('\n=== 步骤5: 检查推算期25125 ===');

    const result25125 = results.find(r => r.targetIssue === '25125');
    console.log('25125 处理详情:', JSON.stringify(result25125, null, 2));

    // 检查24124→25125的HWC数据是否在数据库中存在（但不在缓存中）
    const hwcData25125 = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({
            base_issue: '25124',
            target_issue: '25125'
        });

    if (hwcData25125) {
        console.log('\n数据库中 25124→25125 HWC数据:');
        console.log('  存在! 4:1:0组合数:', hwcData25125.hot_warm_cold_data?.['4:1:0']?.length || 0);
    } else {
        console.log('\n数据库中 25124→25125 HWC数据: ❌ 不存在');
    }

    // =============================================
    // 结论
    // =============================================
    console.log('\n' + '='.repeat(60));
    console.log('=== 问题诊断结论 ===');
    console.log('='.repeat(60));

    if (result25125 && !result25125.hasHwcData && result25125.targetID === null) {
        console.log('\n🔴 根本原因已找到:');
        console.log('  推算期25125不在数据库中，所以issueToIdMap.get("25125")返回undefined');
        console.log('  导致targetID为null，无法使用ID-1规则');
        console.log('  回退到数组索引方式，baseIssue = issueToIDArray[30].issue = "25124"');
        console.log('  但issuePairs中没有25124→25125，因为25125不在issueRecords中');
        console.log('  所以hwcOptimizedCache中没有25124-25125的条目');
        console.log('  applyPositiveSelection将fallback到动态计算');
        console.log('\n  但这只能解释推算期为何使用fallback，不能解释已开奖期号为何0组合');
    }

    // 检查已开奖期号的问题
    const openedWithoutHwc = withoutHwc.filter(r => r.targetID !== null);
    if (openedWithoutHwc.length > 0) {
        console.log('\n🔴 已开奖期号缺失HWC缓存:');
        openedWithoutHwc.forEach(r => {
            console.log(`  ${r.targetIssue}: hwcKey=${r.hwcKey}`);
        });
    } else {
        console.log('\n✅ 所有已开奖期号都有HWC缓存');
    }

    await mongoose.disconnect();
}

diagnoseCompleteFlow().catch(console.error);
