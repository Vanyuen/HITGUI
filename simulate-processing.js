const mongoose = require('mongoose');

async function simulateProcessing() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟任务的期号范围
    const targetIssues = ['25095', '25096', '25097', '25098', '25099', '25100', '25124', '25125'];

    console.log('=== 模拟 HwcPositivePredictor 预加载 ===\n');

    // 1. 模拟 preloadData 中的期号对生成
    const issueNumbers = targetIssues.map(i => parseInt(i));
    const firstIssueNum = issueNumbers[0];

    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    console.log('第一个期号记录:', firstIssueRecord?.Issue, 'ID:', firstIssueRecord?.ID);

    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
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

    // 构建ID→Record映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // 生成期号对 (模拟代码中的逻辑)
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('issueRecords数量:', issueRecords.length);

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

    console.log('\n生成的期号对:', issuePairs.length, '个');
    issuePairs.forEach(p => console.log('  ', p.base_issue, '->', p.target_issue));

    // 2. 模拟 preloadHwcOptimizedData
    console.log('\n=== 模拟热温冷数据预加载 ===');

    const hwcDataList = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

    console.log('查询到热温冷数据:', hwcDataList.length, '条');

    // 构建缓存
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

    console.log('缓存大小:', hwcOptimizedCache.size);
    console.log('缓存keys:', Array.from(hwcOptimizedCache.keys()).slice(0, 10));

    // 3. 模拟 processBatch 中的处理
    console.log('\n=== 模拟 processBatch 中的缓存查找 ===');

    // 构建期号到ID的映射
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    for (const targetIssue of targetIssues) {
        const targetID = issueToIdMap.get(targetIssue);

        // 查找上一期 (基于ID-1)
        let baseIssue, baseID;
        if (targetID) {
            const baseRecord = idToRecordMap.get(targetID - 1);
            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                baseID = baseRecord.ID;
            }
        }

        // 检查是否存在热温冷数据
        if (baseIssue) {
            const hwcKey = `${baseIssue}-${targetIssue}`;
            const hwcMap = hwcOptimizedCache.get(hwcKey);

            if (hwcMap) {
                const ratio410 = hwcMap.get('4:1:0');
                console.log(`✅ ${targetIssue}: 基准期=${baseIssue}, hwcKey=${hwcKey}, 4:1:0组合数=${ratio410?.length || 0}`);
            } else {
                console.log(`❌ ${targetIssue}: 基准期=${baseIssue}, hwcKey=${hwcKey}, 缓存中无数据`);
            }
        } else {
            console.log(`⚠️ ${targetIssue}: 无法确定基准期 (targetID=${targetID})`);
        }
    }

    // 4. 特别检查推算期 (25125)
    console.log('\n=== 检查推算期 25125 ===');
    const predictedIssue = '25125';
    const predictedData = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: parseInt(predictedIssue) });
    console.log('数据库中是否存在:', predictedData ? '存在' : '不存在');

    // 检查 25124 -> 25125 的热温冷数据
    const hwcFor25125 = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: '25124', target_issue: '25125' });
    console.log('25124->25125 热温冷数据:', hwcFor25125 ? '存在' : '不存在');

    if (hwcFor25125) {
        console.log('  4:1:0组合数:', hwcFor25125.hot_warm_cold_data?.['4:1:0']?.length || 0);
    }

    await mongoose.disconnect();
}

simulateProcessing().catch(console.error);
