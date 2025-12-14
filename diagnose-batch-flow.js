/**
 * 模拟完整的批次处理流程
 * 检查缓存状态在各批次之间的变化
 */
const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('=== 模拟批次处理流程 ===\n');

    const db = mongoose.connection.db;

    // 模拟任务参数：25042-25142 (101期)
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }

    // ============ 模拟preloadData ============
    console.log('[1] 模拟preloadData...');
    const issueNumbers = targetIssues.map(i => parseInt(i));

    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    // 生成issuePairs（包括推算期）
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
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

    // 添加推算期
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

    console.log(`   issuePairs: ${issuePairs.length}个 (含${predictedIssues.length}个推算期)`);

    // 加载HWC缓存
    const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

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

    console.log(`   hwcOptimizedCache: ${hwcOptimizedCache.size}个条目`);
    console.log(`   包含25141-25142: ${hwcOptimizedCache.has('25141-25142')}`);

    // ============ 模拟批次划分 ============
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < targetIssues.length; i += batchSize) {
        batches.push(targetIssues.slice(i, i + batchSize));
    }

    console.log(`\n[2] 批次划分: ${batches.length}个批次`);
    batches.forEach((batch, idx) => {
        console.log(`   Batch ${idx + 1}: ${batch[0]}-${batch[batch.length - 1]} (${batch.length}期)`);
    });

    // ============ 模拟各批次处理 ============
    console.log('\n[3] 模拟各批次的processBatch缓存检查:');

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\n--- Batch ${batchIndex + 1} (${batch[0]}-${batch[batch.length - 1]}) ---`);

        // 模拟processBatch开头的缓存检查
        const cacheIsEmpty = !hwcOptimizedCache || hwcOptimizedCache.size === 0;
        console.log(`   缓存检查: !hwcOptimizedCache=${!hwcOptimizedCache}, size===0=${hwcOptimizedCache?.size === 0}`);
        console.log(`   需要重新加载: ${cacheIsEmpty}`);

        if (cacheIsEmpty) {
            // 模拟缓存重新加载
            console.log('   [模拟缓存重新加载]');
            const batchIssueNumbers = batch.map(i => parseInt(i.toString ? i.toString() : String(i)));
            const firstIssueNum = batchIssueNumbers[0];
            console.log(`   firstIssueNum: ${firstIssueNum}`);

            const firstIssueRecord = await db.collection('hit_dlts')
                .findOne({ Issue: firstIssueNum });

            if (firstIssueRecord) {
                console.log(`   firstIssueRecord: 找到 (Issue=${firstIssueRecord.Issue})`);
                // ... 重新加载逻辑
            } else {
                console.log(`   firstIssueRecord: ❌ 未找到! 重新加载失败`);
                console.log(`   ⚠️ 如果缓存为空且重新加载失败，将无法获取HWC数据`);
            }
        }

        // 检查该批次中关键期号的hwcKey
        const lastIssue = batch[batch.length - 1];
        const lastIssueID = issueToIdMap.get(lastIssue);

        if (lastIssueID) {
            // 已开奖期
            const baseRecord = idToRecordMap.get(lastIssueID - 1);
            if (baseRecord) {
                const hwcKey = `${baseRecord.Issue}-${lastIssue}`;
                const hwcExists = hwcOptimizedCache.has(hwcKey);
                console.log(`   期号${lastIssue}: hwcKey=${hwcKey}, 在缓存中=${hwcExists}`);
            }
        } else {
            // 推算期
            console.log(`   期号${lastIssue}: 是推算期 (ID=null)`);
            // 对于推算期在index=0的情况，需要从数据库查询最新期号
            const latestRecord = await db.collection('hit_dlts').findOne({}, { sort: { ID: -1 } });
            const baseIssue = latestRecord.Issue.toString();
            const hwcKey = `${baseIssue}-${lastIssue}`;
            const hwcExists = hwcOptimizedCache.has(hwcKey);
            console.log(`   期号${lastIssue}: baseIssue=${baseIssue} (从数据库), hwcKey=${hwcKey}, 在缓存中=${hwcExists}`);
        }
    }

    // ============ 关键问题分析 ============
    console.log('\n=== 关键问题分析 ===');
    console.log('如果初始缓存正确加载（包含25141-25142），');
    console.log('且缓存在批次处理过程中不被清空，');
    console.log('则Batch 3应该能正确找到hwcKey=25141-25142的数据。');
    console.log('\n可能的问题：');
    console.log('1. 初始preloadData没有正确加载25141-25142');
    console.log('2. 缓存在批次处理中被清空');
    console.log('3. applyPositiveSelection中baseIssue未正确设置');
    console.log('4. 其他运行时问题');

    await mongoose.disconnect();
    console.log('\n=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
