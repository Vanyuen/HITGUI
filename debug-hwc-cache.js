const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 模拟 preloadHwcOptimizedData 的查询逻辑
  const targetIssues = [];
  for (let i = 25110; i <= 25140; i++) targetIssues.push(i);

  // 1. 获取 issueToIdMap
  const records = await db.collection('hit_dlts').find({Issue: {$in: targetIssues}}).toArray();
  const issueToIdMap = new Map();
  records.forEach(r => issueToIdMap.set(r.Issue.toString(), r.ID));

  console.log('issueToIdMap size:', issueToIdMap.size);
  console.log('Sample mappings:');
  console.log('  25110 ->', issueToIdMap.get('25110'));
  console.log('  25139 ->', issueToIdMap.get('25139'));
  console.log('  25140 ->', issueToIdMap.get('25140'));

  // 2. 模拟 issuePairs 生成 (需要包含 ID-1 的记录)
  const minID = Math.min(...records.map(r => r.ID));
  const maxID = Math.max(...records.map(r => r.ID));
  console.log('\nID range from hit_dlts:', minID, '-', maxID);

  // 获取完整的 ID 范围记录 (包括 minID-1)
  const allRecords = await db.collection('hit_dlts').find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).sort({ID: 1}).toArray();
  console.log('allRecords count:', allRecords.length);

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  const issuePairs = [];
  for (const record of records) {
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
  console.log('\nissuePairs count:', issuePairs.length);
  console.log('First pair:', issuePairs[0]);
  console.log('Last pair:', issuePairs[issuePairs.length - 1]);

  // 3. 模拟 target_id 范围查询
  const targetIds = issuePairs.map(p => issueToIdMap.get(p.target_issue)).filter(id => id !== undefined);
  console.log('\ntargetIds count:', targetIds.length);
  const minTargetId = Math.min(...targetIds);
  const maxTargetId = Math.max(...targetIds);
  console.log('target_id range for query:', minTargetId, '-', maxTargetId);

  // 4. 执行查询
  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').find({
    target_id: { $gte: minTargetId, $lte: maxTargetId }
  }).toArray();
  console.log('\nHWC data count from query:', hwcDataList.length);

  // 5. 构建缓存
  const hwcOptimizedCache = new Map();
  for (const data of hwcDataList) {
    const key = `${data.base_issue}-${data.target_issue}`;
    if (data.hot_warm_cold_data) {
      const hwcMap = new Map();
      for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
        hwcMap.set(ratio, ids);
      }
      hwcOptimizedCache.set(key, hwcMap);
    }
  }
  console.log('hwcOptimizedCache size:', hwcOptimizedCache.size);

  // 6. 测试缓存查找
  console.log('\nTesting cache lookup:');
  const testKey1 = '25109-25110';
  const hwcMap1 = hwcOptimizedCache.get(testKey1);
  console.log(`  ${testKey1}: exists=${!!hwcMap1}, 4:1:0 count=${hwcMap1?.get('4:1:0')?.length || 0}`);

  const testKey2 = '25138-25139';
  const hwcMap2 = hwcOptimizedCache.get(testKey2);
  console.log(`  ${testKey2}: exists=${!!hwcMap2}, 4:1:0 count=${hwcMap2?.get('4:1:0')?.length || 0}`);

  mongoose.disconnect();
});
