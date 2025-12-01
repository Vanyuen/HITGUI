const mongoose = require('mongoose');

async function simulateCacheFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 模拟缓存流程 ===');

    const hit_dlts = mongoose.connection.db.collection('hit_dlts');
    const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 获取期号列表 (类似 processBatch 传入的 issuesBatch)
    const issuesBatch = [25075, 25076, 25077]; // 模拟数字类型
    console.log('issuesBatch (数字):', issuesBatch);

    // 模拟 issueToIDArray 构建 (line 16677-16684)
    const issueToIDArray = issuesBatch.map((issue, index) => {
        const issueStr = issue.toString();
        return { issue: issueStr, id: null, index };
    });
    console.log('issueToIDArray:', issueToIDArray);

    // 模拟 preloadData 中构建 issuePairs
    const allRecords = await hit_dlts.find({ Issue: { $in: issuesBatch } })
        .project({ Issue: 1, ID: 1 })
        .sort({ ID: 1 })
        .toArray();

    console.log('\n数据库记录:');
    allRecords.forEach(r => console.log('  Issue:', r.Issue, '(type:', typeof r.Issue, '), ID:', r.ID));

    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // 构建期号对 (模拟 line 16411-16423)
    const issuePairs = [];
    for (const record of allRecords) {
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

    console.log('\n生成的 issuePairs:');
    issuePairs.forEach(p => console.log('  base_issue:', p.base_issue, '(type:', typeof p.base_issue, '), target_issue:', p.target_issue));

    // 模拟 preloadHwcOptimizedData 查询 (line 15119-15124)
    console.log('\n=== 模拟 HWC 查询 ===');
    const query = {
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    };
    console.log('Query:', JSON.stringify(query, null, 2));

    const hwcDataList = await HwcOptimized.find(query).toArray();
    console.log('\n查询结果:', hwcDataList.length, '条');

    // 构建缓存 (模拟 line 15127-15142)
    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = data.base_issue + '-' + data.target_issue;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log('  缓存key:', key, ', 比例数:', hwcMap.size);
        }
    }

    console.log('\nhwcOptimizedCache size:', hwcOptimizedCache.size);

    // 模拟 applyPositiveSelection 中的缓存查找 (line 15440-15441)
    console.log('\n=== 模拟缓存查找 ===');
    for (const pair of issuePairs) {
        const hwcKey = pair.base_issue + '-' + pair.target_issue;
        const hwcMap = hwcOptimizedCache.get(hwcKey);
        console.log('hwcKey:', hwcKey, '→', hwcMap ? '找到 (比例数=' + hwcMap.size + ')' : '未找到');

        if (hwcMap) {
            // 模拟 Step1 热温冷比筛选
            const ratioKey = '4:1:0';
            const ids = hwcMap.get(ratioKey) || [];
            console.log('  比例', ratioKey, ':', ids.length, '个组合');
        }
    }

    await mongoose.disconnect();
}

simulateCacheFlow().catch(console.error);
