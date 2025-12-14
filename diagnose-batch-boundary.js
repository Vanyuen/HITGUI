const { MongoClient } = require('mongodb');
async function check() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  // 模拟preloadData中的逻辑
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i);
  }

  // 查询所有目标期号
  const targetRecords = await db.collection('hit_dlts').find({
    Issue: { $in: targetIssues }
  }).sort({ ID: 1 }).toArray();

  console.log('目标期号数:', targetRecords.length);

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log(`ID范围: ${minID} - ${maxID}`);

  // 查询完整ID范围
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ ID: 1 }).toArray();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }

  // 生成issuePairs
  const issueRecords = allRecords.filter(r => targetIssues.includes(r.Issue));
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

  console.log('生成的issuePairs数量:', issuePairs.length);

  // 设置firstIssuePreviousRecord
  const firstPair = issuePairs[0];
  const firstIssuePreviousRecord = {
    issue: firstPair.base_issue,
    id: issueToIdMap.get(firstPair.base_issue)
  };
  console.log('\nfirstIssuePreviousRecord:', firstIssuePreviousRecord);

  // 加载hwcOptimizedCache
  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .find({
      $or: issuePairs.map(p => ({
        base_issue: p.base_issue,
        target_issue: p.target_issue
      }))
    }).toArray();

  const hwcOptimizedCache = new Map();
  for (const data of hwcDataList) {
    const key = `${data.base_issue}-${data.target_issue}`;
    if (data.hot_warm_cold_data) {
      hwcOptimizedCache.set(key, data.hot_warm_cold_data);
    }
  }
  console.log('hwcOptimizedCache大小:', hwcOptimizedCache.size);

  // 模拟批次划分（batchSize=50）
  const batchSize = 50;
  const allIssues = targetIssues.map(i => i.toString());

  const batches = [];
  for (let i = 0; i < allIssues.length; i += batchSize) {
    batches.push(allIssues.slice(i, i + batchSize));
  }

  console.log('\n=== 批次划分 ===');
  console.log('批次数:', batches.length);

  // 模拟每个批次的处理
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const issuesBatch = batches[batchIndex];
    console.log(`\n=== 批次${batchIndex + 1}: ${issuesBatch[0]} - ${issuesBatch[issuesBatch.length - 1]} (${issuesBatch.length}期) ===`);

    // 构建issueToIDArray
    const issueToIDArray = issuesBatch.map((issue, index) => {
      const id = issueToIdMap.get(issue);
      return { issue, id: id || null, index };
    });

    // 检查该批次边界期号的处理
    const boundaryPeriods = [
      issueToIDArray[0],  // 第一个
      issueToIDArray[Math.min(1, issueToIDArray.length - 1)],  // 第二个
      issueToIDArray[issueToIDArray.length - 1]  // 最后一个
    ];

    for (const { issue: targetIssue, id: targetID, index: i } of issueToIDArray) {
      // 只显示第一个、第二个和最后一个期号的详情
      if (i !== 0 && i !== 1 && i !== issueToIDArray.length - 1) continue;

      let baseIssue, baseID;
      let source = '';

      if (i === 0) {
        // 第一个期号：使用firstIssuePreviousRecord
        baseIssue = firstIssuePreviousRecord.issue;
        baseID = firstIssuePreviousRecord.id;
        source = 'firstIssuePreviousRecord';
      } else {
        // 使用ID-1规则
        const baseRecord = idToRecordMap.get(targetID - 1);
        if (baseRecord) {
          baseIssue = baseRecord.Issue.toString();
          baseID = baseRecord.ID;
          source = 'ID-1规则';
        } else {
          baseIssue = issueToIDArray[i - 1].issue;
          baseID = issueToIDArray[i - 1].id;
          source = '数组fallback';
        }
      }

      const hwcKey = `${baseIssue}-${targetIssue}`;
      const hwcExists = hwcOptimizedCache.has(hwcKey);
      const status = hwcExists ? '✅' : '❌';

      console.log(`  期号${targetIssue} (index=${i}): base=${baseIssue}, hwcKey=${hwcKey}, 缓存=${status}, 来源=${source}`);

      // 如果是第一个且不是batch1，检查问题
      if (i === 0 && batchIndex > 0) {
        // 这个期号正确的baseIssue应该是什么？
        const correctBaseRecord = idToRecordMap.get(targetID - 1);
        if (correctBaseRecord) {
          const correctBaseIssue = correctBaseRecord.Issue.toString();
          const correctHwcKey = `${correctBaseIssue}-${targetIssue}`;
          const correctHwcExists = hwcOptimizedCache.has(correctHwcKey);

          if (baseIssue !== correctBaseIssue) {
            console.log(`    ⚠️ 问题: 使用了错误的baseIssue!`);
            console.log(`       实际使用: ${baseIssue} (hwcKey=${hwcKey}, 缓存=${hwcExists ? '✅' : '❌'})`);
            console.log(`       应该使用: ${correctBaseIssue} (hwcKey=${correctHwcKey}, 缓存=${correctHwcExists ? '✅' : '❌'})`);
          }
        }
      }
    }
  }

  await client.close();
}
check().catch(console.error);
