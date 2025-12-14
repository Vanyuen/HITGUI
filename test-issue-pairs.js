const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟targetIssues（最近101期）
    // 根据任务配置：25042-25142
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }
    console.log('目标期号数:', targetIssues.length);
    console.log('最后5期:', targetIssues.slice(-5));

    // 模拟preloadData中的逻辑
    const hit_dlts = mongoose.connection.collection('hit_dlts');

    // 1. 转换为数字
    const issueNumbers = targetIssues.map(i => parseInt(i.toString()));
    console.log('\n转换后期号数:', issueNumbers.length);

    // 2. 查询第一个期号
    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await hit_dlts.findOne({ Issue: firstIssueNum });
    console.log('第一个期号', firstIssueNum, ':', firstIssueRecord ? 'EXISTS, ID=' + firstIssueRecord.ID : 'NOT FOUND');

    // 3. 查询所有目标期号
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();
    console.log('\n数据库中存在的期号数:', targetRecords.length);
    console.log('最后3期:', targetRecords.slice(-3).map(r => ({ Issue: r.Issue, ID: r.ID })));

    // 4. 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('\nID范围:', minID, '-', maxID);

    // 5. 查询完整ID范围（包含base期）
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    }).sort({ ID: 1 }).toArray();
    console.log('完整ID范围记录数:', allRecords.length);

    // 6. 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }
    console.log('期号→ID映射数:', issueToIdMap.size);

    // 7. 生成期号对（关键步骤！）
    const issuePairs = [];
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\n目标期号记录数:', issueRecords.length);

    for (const record of issueRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: targetIssue
            });
        } else {
            console.log('  ⚠️ 期号', targetIssue, '(ID=' + targetID + ') 找不到base期 (ID=' + (targetID-1) + ')');
        }
    }

    console.log('\n生成的期号对数:', issuePairs.length);
    console.log('最后3个期号对:', issuePairs.slice(-3));

    // 8. 检查25141和25142的期号对
    const pair25141 = issuePairs.find(p => p.target_issue === '25141');
    const pair25142 = issuePairs.find(p => p.target_issue === '25142');
    console.log('\n25141期号对:', pair25141 || '❌ 不存在');
    console.log('25142期号对:', pair25142 || '❌ 不存在');

    // 9. 检查推算期（25142）在issueNumbers中吗？
    console.log('\n25142在issueNumbers中:', issueNumbers.includes(25142));
    console.log('25142在数据库中:', issueToIdMap.has('25142'));

    await mongoose.disconnect();
}

test().catch(console.error);
