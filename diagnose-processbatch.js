const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 模拟processBatch中的关键逻辑
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }

  // 构建issueToIdMap（preloadData中构建）
  const existingRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues.map(i => parseInt(i)) }
  }).sort({ ID: 1 }).toArray();

  const issueToIdMap = new Map();
  for (const r of existingRecords) {
    issueToIdMap.set(r.Issue.toString(), r.ID);
  }

  console.log('issueToIdMap大小:', issueToIdMap.size);
  console.log('25140的ID:', issueToIdMap.get('25140'));
  console.log('25141的ID:', issueToIdMap.get('25141'));
  console.log('25142的ID:', issueToIdMap.get('25142')); // 应该是undefined

  // 构建idToRecordMap
  const minID = existingRecords[0].ID;
  const maxID = existingRecords[existingRecords.length - 1].ID;

  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  console.log('\nidToRecordMap大小:', idToRecordMap.size);
  console.log('ID 2808的Issue:', idToRecordMap.get(2808)?.Issue);
  console.log('ID 2809的Issue:', idToRecordMap.get(2809)?.Issue);
  console.log('ID 2810的Issue:', idToRecordMap.get(2810)?.Issue); // 应该是undefined

  // 模拟processBatch中的issueToIDArray构建
  console.log('\n=== 模拟issueToIDArray ===');

  // issuesBatch是targetIssues的一个批次，假设包含25140, 25141, 25142
  const issuesBatch = ['25140', '25141', '25142'];

  const issueToIDArray = issuesBatch.map((issue, index) => {
    const id = issueToIdMap.get(issue);
    return { issue, id: id || null, index };
  });

  console.log('issueToIDArray:', issueToIDArray);

  // 模拟处理循环
  console.log('\n=== 模拟processBatch处理循环 ===');

  // 假设firstIssuePreviousRecord已设置
  const firstIssuePreviousRecord = {
    issue: '25041',
    id: 2709
  };

  for (let i = 0; i < issueToIDArray.length; i++) {
    const { issue: targetIssue, id: targetID } = issueToIDArray[i];

    console.log(`\n处理期号 ${targetIssue} (index=${i}, targetID=${targetID}):`);

    let baseIssue, baseID;

    if (i === 0) {
      baseIssue = firstIssuePreviousRecord.issue;
      baseID = firstIssuePreviousRecord.id;
      console.log(`  (第一个期号) baseIssue=${baseIssue}, baseID=${baseID}`);
    } else {
      if (targetID === null) {
        // targetID为null，使用数组fallback
        baseIssue = issueToIDArray[i - 1].issue;
        baseID = issueToIDArray[i - 1].id;
        console.log(`  ❌ targetID为null，fallback到前一个: baseIssue=${baseIssue}, baseID=${baseID}`);
      } else {
        // 使用ID-1规则
        const baseRecord = idToRecordMap.get(targetID - 1);
        if (baseRecord) {
          baseIssue = baseRecord.Issue.toString();
          baseID = baseRecord.ID;
          console.log(`  ✅ ID-1规则: baseIssue=${baseIssue}, baseID=${baseID}`);
        } else {
          // ID-1不存在，fallback
          baseIssue = issueToIDArray[i - 1].issue;
          baseID = issueToIDArray[i - 1].id;
          console.log(`  ⚠️ ID-1不存在，fallback: baseIssue=${baseIssue}, baseID=${baseID}`);
        }
      }
    }

    const hwcKey = `${baseIssue}-${targetIssue}`;
    console.log(`  hwcKey: ${hwcKey}`);

    // 检查hwcOptimizedCache中是否有这个key
    const hwcCol = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const hwcData = await hwcCol.findOne({
      base_issue: baseIssue,
      target_issue: targetIssue
    });
    console.log(`  HWC数据: ${hwcData ? '✅ 有' : '❌ 无'}`);
  }

  await client.close();
}
check().catch(console.error);
