const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 模拟processBatch的处理逻辑

    // 假设 issuesBatch = ['25140', '25141', '25142']
    const issuesBatch = ['25140', '25141', '25142'];

    // 模拟 issueToIdMap（从preloadData构建）
    const hit_dlts = mongoose.connection.collection('hit_dlts');

    // 构建 issueToIdMap
    const records = await hit_dlts.find({
        Issue: { $in: [25140, 25141] }
    }).toArray();

    const issueToIdMap = new Map();
    for (const r of records) {
        issueToIdMap.set(r.Issue.toString(), r.ID);
    }
    console.log('issueToIdMap:', Object.fromEntries(issueToIdMap));

    // 构建 idToRecordMap
    const allRecords = await hit_dlts.find({
        ID: { $gte: 2807, $lte: 2809 }
    }).toArray();

    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    console.log('idToRecordMap keys:', [...idToRecordMap.keys()]);

    // 模拟 issueToIDArray
    console.log('\n=== 模拟processBatch中的issueToIDArray ===');
    const issueToIDArray = issuesBatch.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        console.log(`  Issue ${issueStr}: ID=${id || 'null'}`);
        return { issue: issueStr, id: id || null, index };
    });

    // 模拟处理循环
    console.log('\n=== 模拟处理循环 ===');
    for (let i = 0; i < issueToIDArray.length; i++) {
        const { issue: targetIssue, id: targetID } = issueToIDArray[i];

        console.log(`\n处理期号 ${targetIssue} (index=${i}):`);
        console.log(`  targetID: ${targetID}`);

        let baseIssue, baseID;

        if (i === 0) {
            // 第一个期号：使用预加载的上一期
            console.log('  使用 firstIssuePreviousRecord (假设已设置)');
            baseIssue = '25139';
            baseID = 2807;
        } else {
            // 其他期号：使用 ID-1 规则
            if (targetID === null) {
                console.log('  ❌ targetID为null，无法计算ID-1');
                console.log('  尝试使用数组fallback: issueToIDArray[i-1]');
                baseIssue = issueToIDArray[i - 1].issue;
                baseID = issueToIDArray[i - 1].id;
                console.log(`  fallback结果: base=${baseIssue}, baseID=${baseID}`);
            } else {
                const baseRecord = idToRecordMap.get(targetID - 1);
                if (baseRecord) {
                    baseIssue = baseRecord.Issue.toString();
                    baseID = baseRecord.ID;
                    console.log(`  使用ID-1规则: base=${baseIssue} (ID ${baseID}→${targetID})`);
                } else {
                    console.log(`  ❌ ID-1记录不存在 (ID=${targetID - 1})`);
                    baseIssue = issueToIDArray[i - 1].issue;
                    baseID = issueToIDArray[i - 1].id;
                    console.log(`  fallback结果: base=${baseIssue}, baseID=${baseID}`);
                }
            }
        }

        // 检查hwcKey
        const hwcKey = `${baseIssue}-${targetIssue}`;
        console.log(`  hwcKey: ${hwcKey}`);
    }

    await mongoose.disconnect();
}

test().catch(console.error);
