/**
 * 诊断脚本：测试修复后的processBatch中baseIssue确定逻辑
 */
const { MongoClient } = require('mongodb');

async function test() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 模拟数据准备
  const targetIssues = [];
  for (let i = 25042; i <= 25050; i++) {
    targetIssues.push(i);
  }

  // 查询目标期号的ID
  const targetRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  console.log('目标期号数:', targetRecords.length);

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;

  // 查询完整ID范围
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  // 构建映射
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }

  console.log('idToRecordMap大小:', idToRecordMap.size);
  console.log('issueToIdMap大小:', issueToIdMap.size);

  // 模拟processBatch的issueToIDArray
  const issuesBatch = targetIssues.map(i => i.toString());
  const issueToIDArray = issuesBatch.map((issue, index) => {
    const id = issueToIdMap.get(issue);
    return { issue, id: id || null, index };
  });

  console.log('\n=== 修复后的逻辑模拟 ===');

  for (let i = 0; i < issueToIDArray.length; i++) {
    const { issue: targetIssue, id: targetID } = issueToIDArray[i];
    let baseIssue, baseID;
    let method = '';

    // 新的修复逻辑
    if (targetID !== null) {
      // 情况1：当前期号在数据库中存在，使用ID-1规则
      const baseRecord = idToRecordMap.get(targetID - 1);

      if (baseRecord) {
        baseIssue = baseRecord.Issue.toString();
        baseID = baseRecord.ID;
        method = 'ID-1规则';
      } else if (i > 0) {
        // ID-1记录不存在且不是第一个，使用数组fallback
        baseIssue = issueToIDArray[i - 1].issue;
        baseID = issueToIDArray[i - 1].id;
        method = '数组fallback';
      } else {
        // 是第一个且ID-1不存在，需要firstIssuePreviousRecord
        method = '需要firstIssuePreviousRecord';
      }
    } else {
      // 情况2：推算期
      method = '推算期';
      if (i > 0) {
        baseIssue = issueToIDArray[i - 1].issue;
        baseID = issueToIDArray[i - 1].id;
      }
    }

    // 检查HWC缓存是否存在
    const hwcKey = baseIssue && targetIssue ? `${baseIssue}-${targetIssue}` : null;
    let hwcExists = false;

    if (hwcKey) {
      const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: baseIssue, target_issue: targetIssue });
      hwcExists = !!hwcData;
    }

    console.log(`期号${targetIssue} (ID=${targetID}): base=${baseIssue}, hwcKey=${hwcKey}, hwc=${hwcExists ? '✅' : '❌'}, 方法=${method}`);
  }

  await client.close();
}

test().catch(console.error);
