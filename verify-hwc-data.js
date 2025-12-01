const mongoose = require('mongoose');

async function verifyHwcData() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 验证 HWC 优化表数据 ===\n');

    // 检查一些关键期号对的数据
    const testPairs = [
        { base: '25094', target: '25095' },
        { base: '25095', target: '25096' },
        { base: '25096', target: '25097' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    for (const pair of testPairs) {
        const hwcData = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .findOne({
                base_issue: pair.base,
                target_issue: pair.target
            });

        if (hwcData) {
            const ratio410 = hwcData.hot_warm_cold_data?.['4:1:0'];
            console.log(`✅ ${pair.base}->${pair.target}: 存在, 4:1:0组合数=${ratio410?.length || 0}`);
        } else {
            console.log(`❌ ${pair.base}->${pair.target}: 不存在!`);
        }
    }

    // 检查数据库中 HWC 表的 base_issue/target_issue 字段类型
    console.log('\n=== 检查字段类型一致性 ===');

    const sample = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({});

    if (sample) {
        console.log('base_issue 类型:', typeof sample.base_issue, '值:', sample.base_issue);
        console.log('target_issue 类型:', typeof sample.target_issue, '值:', sample.target_issue);
    }

    // 检查 hit_dlts 表的 Issue 字段类型
    const issueSample = await mongoose.connection.db.collection('hit_dlts')
        .findOne({});

    if (issueSample) {
        console.log('\nhit_dlts.Issue 类型:', typeof issueSample.Issue, '值:', issueSample.Issue);
    }

    // 模拟 issuePairs 生成并检查
    console.log('\n=== 模拟 issuePairs 生成 ===');

    const targetIssues = ['25095', '25096', '25097'];
    const issueNumbers = targetIssues.map(i => parseInt(i));

    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    console.log('firstIssueRecord:', firstIssueRecord?.Issue, 'ID:', firstIssueRecord?.ID);

    // 生成 allIssueNums (这里有潜在bug: 混合了ID和Issue)
    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
    console.log('allIssueNums:', allIssueNums);
    console.log('注意: 第一个元素是ID, 其余是Issue号码!');

    // 正确的查询方式
    const allRecords = await mongoose.connection.db.collection('hit_dlts')
        .find({
            $or: [
                { ID: { $in: allIssueNums } },
                { Issue: { $in: issueNumbers } }
            ]
        })
        .sort({ ID: 1 })
        .toArray();

    console.log('\nallRecords数量:', allRecords.length);
    allRecords.forEach(r => console.log('  Issue:', r.Issue, 'ID:', r.ID));

    // 生成期号对 (模拟代码)
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));

    console.log('\nissueRecords数量:', issueRecords.length);

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
            console.log(`  生成期号对: ${baseRecord.Issue.toString()}->${targetIssue}`);
        }
    }

    // 使用生成的 issuePairs 查询 HWC 表
    console.log('\n=== 使用生成的期号对查询 HWC 表 ===');

    if (issuePairs.length > 0) {
        const hwcQuery = {
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        };

        const hwcDataList = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find(hwcQuery)
            .toArray();

        console.log('查询到的 HWC 数据数量:', hwcDataList.length);
        hwcDataList.forEach(d => {
            console.log(`  ${d.base_issue}->${d.target_issue}: 4:1:0=${d.hot_warm_cold_data?.['4:1:0']?.length || 0}个组合`);
        });
    }

    await mongoose.disconnect();
}

verifyHwcData().catch(console.error);
