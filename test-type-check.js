// 类型检查测试脚本
const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('=== 类型检查测试 ===\n');

    const db = mongoose.connection.db;

    // 模拟preloadData中的构建逻辑
    const issueNumbers = [25140, 25141, 25142];
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();

    // 模拟preloadData中的issueToIdMap构建 (line 16850-16854)
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    console.log('issueToIdMap构建:');
    console.log('  键类型 (Issue as string):', typeof Array.from(issueToIdMap.keys())[0]);
    console.log('  值类型 (ID):', typeof issueToIdMap.get('25140'));

    // 模拟processBatch中的逻辑 (line 17026-17033)
    const issuesBatch = ['25140', '25141', '25142'];  // 字符串数组
    const issueToIDArray = issuesBatch.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        console.log('  Issue', issueStr, '-> ID:', id, '(type:', typeof id + ')');
        return { issue: issueStr, id: id || null, index };
    });

    // 模拟processBatch中的baseRecord查找 (line 17045)
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    console.log('\n模拟processBatch查找:');
    for (const item of issueToIDArray) {
        if (item.id != null) {
            const targetID = item.id;
            const baseRecord = idToRecordMap.get(targetID - 1);
            console.log(`  期号 ${item.issue}: targetID=${targetID}, targetID-1=${targetID - 1}, baseRecord=${baseRecord ? 'Issue=' + baseRecord.Issue : 'NOT FOUND'}`);
        } else {
            console.log(`  期号 ${item.issue}: 推算期 (id=null)`);
        }
    }

    await mongoose.disconnect();
    console.log('\n=== 测试完成 ===');
}

test().catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
});
