/**
 * 精确诊断批次边界问题
 * 重点：模拟HwcPositivePredictor的preloadData和processBatch逻辑
 */
const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('=== 精确诊断批次边界问题 ===\n');

    const db = mongoose.connection.db;

    // 模拟任务参数：25042-25142 (101期)
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }
    console.log(`[参数] 目标期号: ${targetIssues[0]}-${targetIssues[targetIssues.length - 1]} (共${targetIssues.length}期)\n`);

    // ============ 模拟preloadData ============
    console.log('=== 模拟preloadData ===\n');

    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询所有目标期号获取它们的ID
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`[Step 1] 查询目标期号: 找到${targetRecords.length}条记录`);
    console.log(`  最后5条: ${targetRecords.slice(-5).map(r => `${r.Issue}(ID=${r.ID})`).join(', ')}`);

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log(`  ID范围: ${minID} - ${maxID}`);

    // 使用ID范围查询
    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    console.log(`\n[Step 2] ID范围查询: 找到${allRecords.length}条记录 (ID ${minID - 1} ~ ${maxID})`);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    console.log(`  idToRecordMap大小: ${idToRecordMap.size}`);
    console.log(`  issueToIdMap大小: ${issueToIdMap.size}`);

    // 检查关键ID是否在idToRecordMap中
    console.log('\n[Step 3] 检查关键ID存在性:');
    const criticalIDs = [2807, 2808, 2809];  // 25139, 25140, 25141对应的ID
    for (const id of criticalIDs) {
        const record = idToRecordMap.get(id);
        console.log(`  ID ${id}: ${record ? `存在 (Issue=${record.Issue})` : '不存在!'}`);
    }

    // 生成期号对
    console.log('\n[Step 4] 生成期号对:');
    const issuePairs = [];
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));

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

    // 处理推算期
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));

    if (predictedIssues.length > 0) {
        const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
        const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);
        if (maxRecord) {
            for (const predictedIssue of predictedIssues) {
                issuePairs.push({
                    base_issue: maxRecord.Issue.toString(),
                    target_issue: predictedIssue.toString()
                });
            }
        }
    }

    console.log(`  生成了${issuePairs.length}个期号对 (含${predictedIssues.length}个推算期)`);
    console.log(`  最后5个: ${issuePairs.slice(-5).map(p => `${p.base_issue}->${p.target_issue}`).join(', ')}`);

    // 检查关键期号对
    console.log('\n[Step 5] 检查关键期号对:');
    const keyPairs = [
        { base: '25139', target: '25140' },
        { base: '25140', target: '25141' },
        { base: '25141', target: '25142' }
    ];
    for (const pair of keyPairs) {
        const found = issuePairs.find(p => p.base_issue === pair.base && p.target_issue === pair.target);
        console.log(`  ${pair.base}->${pair.target}: ${found ? '✅ 在列表中' : '❌ 不在列表中'}`);
    }

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

    console.log(`[缓存构建] hwcOptimizedCache大小: ${hwcOptimizedCache.size}`);
    console.log(`  最后5个key: ${Array.from(hwcOptimizedCache.keys()).slice(-5).join(', ')}`);

    // 检查关键期号对在缓存中
    console.log('\n[Step 6] 检查关键期号对在缓存中:');
    const testKeys = ['25139-25140', '25140-25141', '25141-25142'];
    for (const key of testKeys) {
        const hwcMap = hwcOptimizedCache.get(key);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1') || [];
            console.log(`  ${key}: ✅ 找到 (3:1:1有${ratio311.length}个组合)`);
        } else {
            console.log(`  ${key}: ❌ 未找到!`);
        }
    }

    // ============ 模拟批次处理 ============
    console.log('\n=== 模拟批次处理 ===\n');

    // 创建批次 (每批50期)
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < targetIssues.length; i += batchSize) {
        batches.push(targetIssues.slice(i, i + batchSize));
    }

    console.log(`[批次划分] 共${batches.length}个批次:`);
    batches.forEach((batch, idx) => {
        console.log(`  Batch ${idx + 1}: ${batch[0]}-${batch[batch.length - 1]} (${batch.length}期)`);
    });

    // 检查Batch 2和Batch 3的边界处理
    console.log('\n[Batch 2 最后5期处理]:');
    const batch2 = batches[1];
    const batch2Last5 = batch2.slice(-5);

    for (const targetIssue of batch2Last5) {
        const targetID = issueToIdMap.get(targetIssue);
        let baseIssue, hwcKey;

        if (targetID !== null && targetID !== undefined) {
            const baseRecord = idToRecordMap.get(targetID - 1);
            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                hwcKey = `${baseIssue}-${targetIssue}`;

                const hwcMap = hwcOptimizedCache.get(hwcKey);
                const ratio311Count = hwcMap?.get('3:1:1')?.length || 0;
                console.log(`  ${targetIssue}: targetID=${targetID}, baseIssue=${baseIssue}, hwcKey=${hwcKey}, 3:1:1=${ratio311Count}个`);
            } else {
                console.log(`  ${targetIssue}: targetID=${targetID}, baseRecord不存在! (ID-1=${targetID - 1})`);
            }
        }
    }

    console.log('\n[Batch 3 处理 (推算期)]:');
    if (batches[2]) {
        for (let i = 0; i < batches[2].length; i++) {
            const targetIssue = batches[2][i];
            const targetID = issueToIdMap.get(targetIssue);

            console.log(`  期号 ${targetIssue}:`);
            console.log(`    targetID: ${targetID !== undefined ? targetID : '未定义 (推算期)'}`);
            console.log(`    批次内index: ${i}`);

            if (targetID !== undefined && targetID !== null) {
                const baseRecord = idToRecordMap.get(targetID - 1);
                if (baseRecord) {
                    const hwcKey = `${baseRecord.Issue}-${targetIssue}`;
                    const hwcMap = hwcOptimizedCache.get(hwcKey);
                    console.log(`    使用ID-1规则: baseIssue=${baseRecord.Issue}, hwcKey=${hwcKey}`);
                    console.log(`    hwcMap存在: ${!!hwcMap}`);
                }
            } else {
                // 推算期
                if (i > 0) {
                    const prevIssue = batches[2][i - 1];
                    const hwcKey = `${prevIssue}-${targetIssue}`;
                    const hwcMap = hwcOptimizedCache.get(hwcKey);
                    console.log(`    使用前一期: baseIssue=${prevIssue}, hwcKey=${hwcKey}`);
                    console.log(`    hwcMap存在: ${!!hwcMap}`);
                } else {
                    // i===0, 需要查数据库
                    const latestRecord = await db.collection('hit_dlts').findOne({}, { sort: { ID: -1 } });
                    const baseIssue = latestRecord.Issue.toString();
                    const hwcKey = `${baseIssue}-${targetIssue}`;
                    const hwcMap = hwcOptimizedCache.get(hwcKey);
                    console.log(`    推算期在批次index=0, 使用数据库最新期号: baseIssue=${baseIssue}`);
                    console.log(`    hwcKey=${hwcKey}`);
                    console.log(`    hwcMap存在: ${!!hwcMap}`);
                    if (!hwcMap) {
                        console.log(`    ❌ 这是问题！hwcOptimizedCache中没有这个key`);
                        console.log(`    缓存中所有以25141开头的key: ${Array.from(hwcOptimizedCache.keys()).filter(k => k.startsWith('25141')).join(', ') || '无'}`);
                    }
                }
            }
        }
    }

    // ============ 检查实际任务结果 ============
    console.log('\n=== 检查实际任务结果 ===\n');

    const taskResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ period: { $in: ['25140', '25141', '25142'] } })
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();

    console.log(`[任务结果] 找到${taskResults.length}条结果:`);
    for (const result of taskResults) {
        console.log(`  期号 ${result.period}:`);
        console.log(`    base_period: ${result.base_period}`);
        console.log(`    combination_count: ${result.combination_count}`);
        console.log(`    step1_count: ${result.step1_count}`);
        console.log(`    is_predicted: ${result.is_predicted}`);
        console.log(`    task_id: ${result.task_id}`);
        console.log('');
    }

    await mongoose.disconnect();
    console.log('=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
