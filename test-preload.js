const mongoose = require('mongoose');

async function testFullPreload() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟 targetIssues
    const targetIssues = ['25025', '25026', '25027'];
    const issueNumbers = targetIssues.map(i => parseInt(String(i)));

    // 模拟完整的期号对生成逻辑
    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    if (!firstIssueRecord) {
        console.log('第一个期号不存在');
        await mongoose.disconnect();
        return;
    }

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

    console.log('=== allRecords ===');
    allRecords.forEach(r => console.log('ID:', r.ID, 'Issue:', r.Issue));

    // 构建ID→Record映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // 生成期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\n=== issueRecords (筛选后) ===');
    issueRecords.forEach(r => console.log('ID:', r.ID, 'Issue:', r.Issue));

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

    console.log('\n=== issuePairs ===');
    issuePairs.forEach(p => console.log(p.base_issue, '->', p.target_issue));

    // 测试热温冷数据预加载
    console.log('\n=== 测试热温冷数据预加载 ===');
    const hwcDataList = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        })
        .toArray();

    console.log('查询到热温冷数据数量:', hwcDataList.length);
    hwcDataList.forEach(d => {
        console.log('期号对:', d.base_issue, '->', d.target_issue);
        console.log('  热温冷比数量:', Object.keys(d.hot_warm_cold_data).length);
        console.log('  4:1:0组合数:', d.hot_warm_cold_data['4:1:0']?.length || '无');
    });

    await mongoose.disconnect();
}

testFullPreload().catch(console.error);
