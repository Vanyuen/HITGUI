const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hit_dlts = mongoose.connection.collection('hit_dlts');
    const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 模拟任务的targetIssues (25042-25142, 共101期)
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i.toString());
    }

    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询所有目标期号
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    console.log('数据库中存在的期号数:', targetRecords.length);

    // 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    // 查询完整ID范围
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    }).sort({ ID: 1 }).toArray();

    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));

    // 生成期号对
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

    console.log('生成的期号对数:', issuePairs.length);

    // 检查HWC查询
    console.log('\n=== 模拟preloadHwcOptimizedData查询 ===');

    const query = {
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    };

    const hwcResults = await hwcCol.find(query).toArray();
    console.log('HWC查询结果数:', hwcResults.length);

    // 找出缺失的期号对
    const foundPairs = new Set(hwcResults.map(h => `${h.base_issue}-${h.target_issue}`));
    const missingPairs = issuePairs.filter(p => !foundPairs.has(`${p.base_issue}-${p.target_issue}`));

    console.log('缺失的期号对数:', missingPairs.length);
    if (missingPairs.length > 0 && missingPairs.length <= 20) {
        console.log('缺失期号对:', missingPairs.map(p => `${p.base_issue}->${p.target_issue}`).join(', '));
    } else if (missingPairs.length > 20) {
        console.log('部分缺失期号对:', missingPairs.slice(0, 10).map(p => `${p.base_issue}->${p.target_issue}`).join(', '), '...');
    }

    // 具体检查有数据和无数据的期号
    console.log('\n=== 检查各target_issue的HWC数据 ===');
    const sampleIssues = [25042, 25096, 25097, 25098, 25136, 25137, 25138, 25139, 25140, 25141];

    for (const issue of sampleIssues) {
        const pair = issuePairs.find(p => p.target_issue === issue.toString());
        if (pair) {
            const hwc = await hwcCol.findOne({
                base_issue: pair.base_issue,
                target_issue: pair.target_issue
            });
            console.log(`${pair.base_issue}->${pair.target_issue}: ${hwc ? '✅ 有数据' : '❌ 无数据'}`);
        } else {
            console.log(`期号 ${issue}: ❌ 没有生成期号对`);
        }
    }

    await mongoose.disconnect();
}

test().catch(console.error);
