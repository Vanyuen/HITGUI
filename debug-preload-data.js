const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 模拟 targetIssues = [25110, 25111, ..., 25140]
  const targetIssues = [];
  for (let i = 25110; i <= 25140; i++) targetIssues.push(i);
  console.log('targetIssues:', targetIssues.length, 'issues');
  console.log('First:', targetIssues[0], 'Last:', targetIssues[targetIssues.length - 1]);

  // 模拟 preloadData 的逻辑
  const issueNumbers = targetIssues.map(i => parseInt(i.toString()));
  console.log('\nissueNumbers:', issueNumbers.length);

  // 查询第一个期号
  const firstIssueNum = issueNumbers[0];
  const firstIssueRecord = await db.collection('hit_dlts').findOne({ Issue: firstIssueNum });
  console.log('\nfirstIssueRecord:', firstIssueRecord ? `Issue=${firstIssueRecord.Issue}, ID=${firstIssueRecord.ID}` : 'NOT FOUND');

  if (firstIssueRecord) {
    // 正常路径：查询所有目标期号获取它们的 ID
    const targetRecords = await db.collection('hit_dlts').find({ Issue: { $in: issueNumbers } })
      .sort({ ID: 1 })
      .toArray();
    console.log('\ntargetRecords count:', targetRecords.length);
    console.log('First target:', targetRecords[0]?.Issue, 'ID:', targetRecords[0]?.ID);
    console.log('Last target:', targetRecords[targetRecords.length - 1]?.Issue, 'ID:', targetRecords[targetRecords.length - 1]?.ID);

    // 注意：25140 不在数据库中，所以 targetRecords 只有 30 条
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('\nID range:', minID, '-', maxID);

    // 使用ID范围查询，包含所有可能的基准期记录
    const allRecords = await db.collection('hit_dlts').find({
      ID: { $gte: minID - 1, $lte: maxID }
    })
      .sort({ ID: 1 })
      .toArray();
    console.log('allRecords count:', allRecords.length);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
      issueToIdMap.set(record.Issue.toString(), record.ID);
    }
    console.log('issueToIdMap size:', issueToIdMap.size);

    // 生成期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\nissueRecords (filtered by issueNumbers):', issueRecords.length);

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
    console.log('issuePairs count:', issuePairs.length);
    console.log('First pair:', issuePairs[0]);
    console.log('Last pair:', issuePairs[issuePairs.length - 1]);

    // 关键问题：25140 不在 issueRecords 中，因为它不在数据库中
    // 所以 issuePairs 只有 30 个，不包含 25140
    console.log('\n=== 关键发现 ===');
    console.log('25140 in issueNumbers:', issueNumbers.includes(25140));
    console.log('25140 in issueRecords:', issueRecords.some(r => r.Issue === 25140));
    console.log('25140 in issuePairs:', issuePairs.some(p => p.target_issue === '25140'));

    // 模拟 preloadHwcOptimizedData
    const targetIds = issuePairs.map(p => issueToIdMap.get(p.target_issue)).filter(id => id !== undefined);
    console.log('\ntargetIds for HWC query:', targetIds.length);
    const minTargetId = Math.min(...targetIds);
    const maxTargetId = Math.max(...targetIds);
    console.log('HWC query range:', minTargetId, '-', maxTargetId);

    // 执行 HWC 查询
    const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').find({
      target_id: { $gte: minTargetId, $lte: maxTargetId }
    }).toArray();
    console.log('HWC data count:', hwcDataList.length);

    // 构建缓存
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

    // 测试缓存查找
    console.log('\n=== 测试缓存查找 ===');
    for (const pair of issuePairs.slice(0, 3)) {
      const key = `${pair.base_issue}-${pair.target_issue}`;
      const hwcMap = hwcOptimizedCache.get(key);
      console.log(`${key}: exists=${!!hwcMap}, 4:1:0=${hwcMap?.get('4:1:0')?.length || 0}`);
    }
  }

  mongoose.disconnect();
});
