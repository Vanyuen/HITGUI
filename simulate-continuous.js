const mongoose = require('mongoose');

async function simulateContinuousRange() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟完整的连续期号范围 (最近30期 + 推算期)
    // 生成 25095 到 25125 的连续期号
    const targetIssues = [];
    for (let i = 25095; i <= 25125; i++) {
        targetIssues.push(String(i));
    }

    console.log('=== 模拟连续期号范围 ===');
    console.log('期号数量:', targetIssues.length);
    console.log('范围:', targetIssues[0], '-', targetIssues[targetIssues.length - 1]);

    const issueNumbers = targetIssues.map(i => parseInt(i));
    const firstIssueNum = issueNumbers[0];

    const firstIssueRecord = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: firstIssueNum });

    console.log('\n第一个期号记录:', firstIssueRecord?.Issue, 'ID:', firstIssueRecord?.ID);

    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
    console.log('allIssueNums 长度:', allIssueNums.length);
    console.log('allIssueNums 前5个:', allIssueNums.slice(0, 5));

    // 这是问题所在！allIssueNums 混合了 ID 和 Issue 号码
    console.log('\n⚠️ 注意: allIssueNums 混合了 ID (2762) 和 Issue 号码 (25095-25125)');
    console.log('ID 范围是 1-2792, Issue 号码范围是 7001-25124');
    console.log('所以 25095 等 Issue 号码不会匹配任何 ID!');

    const allRecords = await mongoose.connection.db.collection('hit_dlts')
        .find({
            $or: [
                { ID: { $in: allIssueNums } },
                { Issue: { $in: issueNumbers } }
            ]
        })
        .sort({ ID: 1 })
        .toArray();

    console.log('\n查询到的记录数:', allRecords.length);
    console.log('预期记录数:', '30期(已开奖) + 1期(ID-1) = 31条');

    // 构建ID→Record映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    console.log('idToRecordMap 大小:', idToRecordMap.size);

    // 检查关键期号的映射
    console.log('\n=== 检查ID映射 ===');

    // 检查25124
    const record25124 = allRecords.find(r => r.Issue === 25124);
    if (record25124) {
        console.log('25124: ID=' + record25124.ID);
        const prevRecord = idToRecordMap.get(record25124.ID - 1);
        console.log('  ID-1 (' + (record25124.ID - 1) + '):', prevRecord ? '存在 (Issue=' + prevRecord.Issue + ')' : '❌ 不存在');
    }

    // 检查25095
    const record25095 = allRecords.find(r => r.Issue === 25095);
    if (record25095) {
        console.log('25095: ID=' + record25095.ID);
        const prevRecord = idToRecordMap.get(record25095.ID - 1);
        console.log('  ID-1 (' + (record25095.ID - 1) + '):', prevRecord ? '存在 (Issue=' + prevRecord.Issue + ')' : '❌ 不存在');
    }

    // 列出所有记录的ID和Issue
    console.log('\n=== 所有记录 ===');
    allRecords.forEach(r => {
        const hasIDMinus1 = idToRecordMap.has(r.ID - 1);
        console.log(`Issue ${r.Issue} (ID ${r.ID}): ID-1(${r.ID - 1}) ${hasIDMinus1 ? '✅' : '❌'}`);
    });

    await mongoose.disconnect();
}

simulateContinuousRange().catch(console.error);
