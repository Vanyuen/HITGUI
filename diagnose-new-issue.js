const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 模拟任务执行过程
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i);
  }

  // 1. 查询目标期号获取ID
  const targetRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  console.log('目标期号查询结果:', targetRecords.length);

  if (targetRecords.length === 0) {
    console.log('❌ 没有找到任何目标期号！');
    await client.close();
    return;
  }

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log('ID范围:', minID, '-', maxID);

  // 2. 查询完整ID范围
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  console.log('完整ID范围查询结果:', allRecords.length);

  // 3. 构建idToRecordMap
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  console.log('idToRecordMap大小:', idToRecordMap.size);

  // 4. 模拟批次处理中的ID-1规则
  console.log('\n=== 模拟processBatch的baseIssue确定 ===');

  // 构建issueToIdMap
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }

  // 模拟issueToIDArray
  const issuesBatch = targetIssues.slice(0, 5).map(i => i.toString());
  const issueToIDArray = issuesBatch.map((issue, index) => {
    const id = issueToIdMap.get(issue);
    return { issue, id: id || null, index };
  });

  console.log('issueToIDArray前5项:', issueToIDArray);

  // 检查每个期号的baseIssue确定
  for (let i = 0; i < issueToIDArray.length; i++) {
    const { issue: targetIssue, id: targetID } = issueToIDArray[i];
    let baseIssue, baseID;
    let method = '';

    if (targetID !== null) {
      const baseRecord = idToRecordMap.get(targetID - 1);

      if (baseRecord) {
        baseIssue = baseRecord.Issue.toString();
        baseID = baseRecord.ID;
        method = 'ID-1规则';
      } else if (i > 0) {
        baseIssue = issueToIDArray[i - 1].issue;
        baseID = issueToIDArray[i - 1].id;
        method = '数组fallback';
      } else {
        method = '无法确定';
      }
    } else {
      method = '推算期';
      if (i > 0) {
        baseIssue = issueToIDArray[i - 1].issue;
        baseID = issueToIDArray[i - 1].id;
      }
    }

    console.log(`期号${targetIssue} (ID=${targetID}): base=${baseIssue}, 方法=${method}`);
  }

  // 5. 检查是否是idToRecordMap的问题
  console.log('\n=== 检查idToRecordMap内容 ===');
  const id2709 = idToRecordMap.get(2709);
  const id2710 = idToRecordMap.get(2710);
  console.log('ID 2709:', id2709 ? `Issue=${id2709.Issue}` : '不存在');
  console.log('ID 2710:', id2710 ? `Issue=${id2710.Issue}` : '不存在');

  await client.close();
}

diagnose().catch(console.error);
