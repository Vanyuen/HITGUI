/**
 * 精确模拟preloadData和processBatch对25142的处理
 */
const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('=== 模拟preloadData对25142的处理 ===\n');

    const db = mongoose.connection.db;

    // 模拟任务参数：25042-25142 (101期)
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }
    console.log(`[参数] 目标期号: ${targetIssues[0]}-${targetIssues[targetIssues.length - 1]} (共${targetIssues.length}期)\n`);

    // ============ 模拟preloadData ============
    const issueNumbers = targetIssues.map(i => parseInt(i));
    console.log('[Step 1] issueNumbers类型:', typeof issueNumbers[0], '示例:', issueNumbers.slice(-3));

    // 查询所有目标期号获取它们的ID
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`[Step 2] targetRecords: ${targetRecords.length}条 (应为100, 因为25142不存在)`);
    console.log('  最后3条:', targetRecords.slice(-3).map(r => `${r.Issue}(ID=${r.ID})`).join(', '));

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    // 使用ID范围查询
    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`[Step 3] allRecords: ${allRecords.length}条 (ID ${minID - 1} ~ ${maxID})`);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    // 过滤目标期号记录
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log(`[Step 4] issueRecords: ${issueRecords.length}条 (在issueNumbers中的记录)`);

    // 检查25142是否在issueRecords中
    const has25142 = issueRecords.some(r => r.Issue === 25142);
    console.log(`  25142在issueRecords中: ${has25142 ? '是' : '否'}`);

    // 生成期号对
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
    console.log(`[Step 5] 已开奖期号对: ${issuePairs.length}个`);
    console.log('  最后3个:', issuePairs.slice(-3).map(p => `${p.base_issue}->${p.target_issue}`).join(', '));

    // ⭐ 关键：为推算期生成期号对
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    console.log(`[Step 6] existingIssueNums大小: ${existingIssueNums.size}`);
    console.log('  25142在existingIssueNums中:', existingIssueNums.has(25142) ? '是' : '否');

    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
    console.log(`[Step 7] predictedIssues: [${predictedIssues.join(', ')}]`);

    if (predictedIssues.length > 0) {
        const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
        console.log(`  maxExistingIssue: ${maxExistingIssue}`);

        const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);
        console.log(`  maxRecord: ${maxRecord ? `Issue=${maxRecord.Issue}, ID=${maxRecord.ID}` : '未找到'}`);

        if (maxRecord) {
            for (const predictedIssue of predictedIssues) {
                issuePairs.push({
                    base_issue: maxRecord.Issue.toString(),
                    target_issue: predictedIssue.toString()
                });
                console.log(`  添加推算期期号对: ${maxRecord.Issue}->${predictedIssue}`);
            }
        }
    }

    console.log(`\n[Step 8] 最终issuePairs: ${issuePairs.length}个`);
    console.log('  最后5个:', issuePairs.slice(-5).map(p => `${p.base_issue}->${p.target_issue}`).join(', '));

    // 检查25141-25142是否在issuePairs中
    const has2514125142 = issuePairs.some(p => p.base_issue === '25141' && p.target_issue === '25142');
    console.log(`  issuePairs包含25141->25142: ${has2514125142 ? '✅ 是' : '❌ 否'}`);

    // ============ 模拟preloadHwcOptimizedData ============
    console.log('\n=== 模拟preloadHwcOptimizedData ===\n');

    const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

    console.log(`[查询结果] 找到${hwcDataList.length}/${issuePairs.length}条HWC数据`);

    // 检查25141-25142是否在结果中
    const hwcFor25142 = hwcDataList.find(d => d.base_issue === '25141' && d.target_issue === '25142');
    if (hwcFor25142) {
        const ratio311 = hwcFor25142.hot_warm_cold_data?.['3:1:1']?.length || 0;
        console.log(`  25141->25142: ✅ 找到, 3:1:1=${ratio311}个组合`);
    } else {
        console.log(`  25141->25142: ❌ 未找到`);
    }

    // 构建hwcOptimizedCache
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

    console.log(`\n[缓存构建] hwcOptimizedCache大小: ${hwcOptimizedCache.size}`);
    console.log(`  包含25141-25142: ${hwcOptimizedCache.has('25141-25142') ? '✅ 是' : '❌ 否'}`);

    // ============ 模拟Batch 3处理 ============
    console.log('\n=== 模拟Batch 3 (25142) 处理 ===\n');

    const batch3 = ['25142'];
    const issueToIDArray = batch3.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        return { issue: issueStr, id: id || null, index };
    });

    console.log('[Batch 3] issueToIDArray:', JSON.stringify(issueToIDArray));

    const item = issueToIDArray[0];
    console.log(`  targetIssue: ${item.issue}`);
    console.log(`  targetID: ${item.id} (应为null，表示推算期)`);
    console.log(`  index: ${item.index}`);

    // 模拟baseIssue确定逻辑
    let baseIssue, baseID;
    if (item.id !== null) {
        console.log('\n  走已开奖期路径 (不应该执行)');
    } else {
        console.log('\n  走推算期路径:');
        if (item.index > 0) {
            console.log('    使用前一个期号 (不应该执行，因为index=0)');
        } else {
            console.log('    index=0，从数据库查询最新期号...');
            const latestRecord = await db.collection('hit_dlts').findOne({}, { sort: { ID: -1 } });
            if (latestRecord) {
                baseIssue = latestRecord.Issue.toString();
                baseID = latestRecord.ID;
                console.log(`    latestRecord: Issue=${latestRecord.Issue}, ID=${latestRecord.ID}`);
                console.log(`    baseIssue设置为: ${baseIssue}`);
            }
        }
    }

    // 模拟applyPositiveSelection中的hwcKey生成
    const hwcKey = `${baseIssue}-${item.issue}`;
    console.log(`\n[applyPositiveSelection] hwcKey: ${hwcKey}`);
    console.log(`  hwcOptimizedCache中存在: ${hwcOptimizedCache.has(hwcKey) ? '✅ 是' : '❌ 否'}`);

    if (hwcOptimizedCache.has(hwcKey)) {
        const hwcMap = hwcOptimizedCache.get(hwcKey);
        const ratio311 = hwcMap.get('3:1:1') || [];
        console.log(`  3:1:1组合数: ${ratio311.length}`);
    }

    await mongoose.disconnect();
    console.log('\n=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
