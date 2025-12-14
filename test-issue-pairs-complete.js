const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 完整模拟preloadData中生成issuePairs的逻辑
    const targetIssues = [];
    for (let i = 25140; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }
    console.log('targetIssues:', targetIssues);

    const hit_dlts = mongoose.connection.collection('hit_dlts');
    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询所有目标期号
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    console.log('targetRecords:', targetRecords.map(r => ({ Issue: r.Issue, ID: r.ID })));

    if (targetRecords.length === 0) {
        console.log('没有找到任何目标期号');
        return;
    }

    // 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('\nID范围:', minID, '-', maxID);

    // 查询完整ID范围
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    }).sort({ ID: 1 }).toArray();

    console.log('allRecords:', allRecords.map(r => ({ Issue: r.Issue, ID: r.ID })));

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // ⭐ 关键：生成期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\nissueRecords (只包含目标期号):', issueRecords.map(r => ({ Issue: r.Issue, ID: r.ID })));

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
            console.log(`  ✅ 期号对: ${baseRecord.Issue}→${targetIssue}`);
        } else {
            console.log(`  ❌ 期号${targetIssue}的上一期不存在`);
        }
    }

    console.log('\n最终生成的issuePairs:', issuePairs);
    console.log('issuePairs数量:', issuePairs.length);

    // ⭐ 检查问题：25142不在issueRecords中！
    console.log('\n=== 问题分析 ===');
    console.log('25142在issueNumbers中:', issueNumbers.includes(25142));
    console.log('25142在issueRecords中:', issueRecords.some(r => r.Issue === 25142));
    console.log('原因: issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue))');
    console.log('      但25142不在allRecords中（因为25142不在数据库中）');

    // ⭐ 这意味着preloadHwcOptimizedData不会加载25141→25142的数据！

    await mongoose.disconnect();
}

test().catch(console.error);
