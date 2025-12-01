const mongoose = require('mongoose');

async function testHwcPreload() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 模拟 preloadHwcOptimizedData ===');

    // 1. 模拟生成期号对
    const targetIssues = ['25095', '25096', '25097'];
    const issueNumbers = targetIssues.map(i => parseInt(i));

    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    console.log('第一个期号记录:', firstIssueRecord?.Issue, 'ID:', firstIssueRecord?.ID);

    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
    console.log('查询ID/Issue:', allIssueNums);

    const allRecords = await mongoose.connection.db.collection('hit_dlts')
        .find({
            $or: [
                { ID: { $in: allIssueNums } },
                { Issue: { $in: issueNumbers } }
            ]
        })
        .project({ Issue: 1, ID: 1 })
        .sort({ ID: 1 })
        .toArray();

    console.log('查询到的记录:', allRecords.map(r => ({ Issue: r.Issue, ID: r.ID })));

    // 生成期号对
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));

    const issuePairs = [];
    for (const record of issueRecords) {
        const baseRecord = idToRecordMap.get(record.ID - 1);
        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: record.Issue.toString()
            });
        }
    }

    console.log('生成的期号对:', issuePairs);

    // 2. 查询热温冷数据
    console.log('\n=== 查询热温冷数据 ===');
    const hwcDataList = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

    console.log('查询到热温冷数据数量:', hwcDataList.length);

    // 3. 构建缓存Map
    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = data.base_issue + '-' + data.target_issue;

        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
            console.log('缓存设置:', key, '热温冷比数量:', hwcMap.size);
        }
    }

    console.log('\n=== 缓存状态 ===');
    console.log('缓存大小:', hwcOptimizedCache.size);
    console.log('缓存key列表:', Array.from(hwcOptimizedCache.keys()));

    // 4. 测试获取 4:1:0
    console.log('\n=== 测试查找4:1:0 ===');
    for (const pair of issuePairs) {
        const key = pair.base_issue + '-' + pair.target_issue;
        const hwcMap = hwcOptimizedCache.get(key);
        if (hwcMap) {
            const ratio410 = hwcMap.get('4:1:0');
            console.log(key, '4:1:0组合数:', ratio410?.length || '无');
        } else {
            console.log(key, '❌ 无缓存数据');
        }
    }

    await mongoose.disconnect();
}

testHwcPreload().catch(console.error);
