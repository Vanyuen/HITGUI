const mongoose = require('mongoose');

async function traceExecutionFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 模拟实际执行流程 ===\n');

    const hit_dlts = mongoose.connection.db.collection('hit_dlts');
    const HwcOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 模拟批次期号（数字类型，如resolveIssueRangeInternal返回后被parseInt处理）
    const issueNumbers = [25075, 25076, 25077, 25124, 25125];
    console.log('1. issueNumbers (模拟parseInt后):', issueNumbers);

    // Step 1: 查询数据库获取记录
    const allRecords = await hit_dlts.find({
        Issue: { $in: issueNumbers }
    }).sort({ ID: 1 }).toArray();

    console.log('\n2. hit_dlts查询结果:');
    for (const r of allRecords) {
        console.log('   Issue:', r.Issue, '(type:', typeof r.Issue, '), ID:', r.ID);
    }

    // Step 2: 构建idToRecordMap (与preloadData逻辑一致)
    const minID = allRecords[0]?.ID || 1;
    const maxID = allRecords[allRecords.length-1]?.ID || 1;
    const extendedQuery = {
        ID: { $gte: minID - 1, $lte: maxID + 1 }
    };
    const extendedRecords = await hit_dlts.find(extendedQuery).sort({ ID: 1 }).toArray();
    const idToRecordMap = new Map(extendedRecords.map(r => [r.ID, r]));
    console.log('\n3. idToRecordMap 大小:', idToRecordMap.size);

    // Step 3: 构建issuePairs (与preloadData逻辑一致)
    const issuePairs = [];
    const issueRecords = extendedRecords.filter(r => issueNumbers.includes(r.Issue));

    console.log('\n4. issuePairs 构建过程:');
    for (const record of issueRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();  // toString() 转换
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            const pair = {
                base_issue: baseRecord.Issue.toString(),  // toString() 转换
                target_issue: targetIssue
            };
            issuePairs.push(pair);
            console.log('   期号对:', pair.base_issue, '->', pair.target_issue,
                       '(类型: base=', typeof pair.base_issue, ', target=', typeof pair.target_issue, ')');
        }
    }
    console.log('\n   issuePairs 总数:', issuePairs.length);

    // Step 4: 查询HWC优化表（与preloadHwcOptimizedData逻辑一致）
    const hwcQuery = {
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    };
    console.log('\n5. HWC查询条件:');
    console.log('   $or 条件数:', hwcQuery.$or.length);
    console.log('   第一个条件:', JSON.stringify(hwcQuery.$or[0]));

    const hwcDataList = await HwcOptimized.find(hwcQuery).toArray();
    console.log('\n6. HWC查询结果:', hwcDataList.length, '条');

    // Step 5: 构建hwcOptimizedCache
    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = data.base_issue + '-' + data.target_issue;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log('   缓存key:', key, ', 比例数:', hwcMap.size);
        }
    }
    console.log('\n7. hwcOptimizedCache 大小:', hwcOptimizedCache.size);

    // Step 6: 模拟processBatch中的缓存查找
    console.log('\n8. === 模拟processBatch查找 ===');
    for (const pair of issuePairs) {
        const hwcKey = pair.base_issue + '-' + pair.target_issue;
        const hwcMap = hwcOptimizedCache.get(hwcKey);
        console.log('   hwcKey:', hwcKey, '->', hwcMap ? '找到 (比例数=' + hwcMap.size + ')' : '未找到');

        if (hwcMap) {
            const ratio410 = hwcMap.get('4:1:0');
            console.log('      4:1:0 组合数:', ratio410?.length || 0);
        }
    }

    // Step 7: 检查推算期(25125)的特殊情况
    console.log('\n9. === 推算期25125的处理 ===');
    const record25125 = await hit_dlts.findOne({ Issue: 25125 });
    console.log('   25125在数据库中:', record25125 ? '存在 (ID=' + record25125.ID + ')' : '不存在');

    // 如果25125不存在，检查如何处理
    if (!record25125) {
        console.log('   25125是推算期，需要检查25124是否存在作为基准期');
        const record25124 = await hit_dlts.findOne({ Issue: 25124 });
        if (record25124) {
            console.log('   25124存在 (ID=' + record25124.ID + ')');
            // 检查HWC数据是否存在
            const hwc25125 = await HwcOptimized.findOne({
                base_issue: '25124',
                target_issue: '25125'
            });
            console.log('   HWC数据 25124->25125:', hwc25125 ? '存在' : '不存在');
        }
    }

    await mongoose.disconnect();
}

traceExecutionFlow().catch(console.error);
