const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('=== 诊断 HWC 任务预加载过程 ===\n');

  // 模拟0pe任务的期号范围 (25027-25140)
  const targetIssues = [];
  for (let i = 25027; i <= 25140; i++) {
    targetIssues.push(i);
  }
  console.log('目标期号范围:', targetIssues[0], '-', targetIssues[targetIssues.length - 1]);
  console.log('期号数量:', targetIssues.length);

  // Step 1: 查询所有目标期号获取它们的 ID
  const issueNumbers = targetIssues.map(i => parseInt(i));
  const targetRecords = await db.collection('hit_dlts')
    .find({ Issue: { $in: issueNumbers } })
    .sort({ ID: 1 })
    .toArray();

  console.log('\n=== Step 1: 查询目标期号 ===');
  console.log('查询到的期号数量:', targetRecords.length);
  if (targetRecords.length > 0) {
    console.log('第一条:', 'Issue=' + targetRecords[0].Issue, 'ID=' + targetRecords[0].ID);
    console.log('最后一条:', 'Issue=' + targetRecords[targetRecords.length - 1].Issue, 'ID=' + targetRecords[targetRecords.length - 1].ID);
  }

  // 检查25140是否存在
  const issue25140 = targetRecords.find(r => r.Issue === 25140);
  console.log('25140在数据库中:', issue25140 ? '存在 ID=' + issue25140.ID : '不存在！（推算期）');

  // Step 2: 计算ID范围并查询完整记录
  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log('\n=== Step 2: ID范围 ===');
  console.log('minID:', minID, '(Issue=' + targetRecords[0].Issue + ')');
  console.log('maxID:', maxID, '(Issue=' + targetRecords[targetRecords.length - 1].Issue + ')');
  console.log('查询范围:', (minID - 1), '-', maxID);

  const allRecords = await db.collection('hit_dlts')
    .find({ ID: { $gte: minID - 1, $lte: maxID } })
    .sort({ ID: 1 })
    .toArray();
  console.log('allRecords 数量:', allRecords.length);

  // Step 3: 构建期号对
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }

  const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
  console.log('\n=== Step 3: 构建期号对 ===');
  console.log('issueRecords 数量:', issueRecords.length);

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
  console.log('期号对数量:', issuePairs.length);
  console.log('第一对:', JSON.stringify(issuePairs[0]));
  console.log('最后一对:', JSON.stringify(issuePairs[issuePairs.length - 1]));

  // Step 4: 预加载HWC优化表
  console.log('\n=== Step 4: 预加载HWC优化表 ===');
  const targetIds = issuePairs
    .map(p => issueToIdMap.get(p.target_issue))
    .filter(id => id !== undefined);

  console.log('targetIds 数量:', targetIds.length);
  const minTargetId = Math.min(...targetIds);
  const maxTargetId = Math.max(...targetIds);
  console.log('target_id 范围:', minTargetId, '-', maxTargetId);

  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .find({ target_id: { $gte: minTargetId, $lte: maxTargetId } })
    .toArray();
  console.log('HWC数据条数:', hwcDataList.length);

  // 构建hwcOptimizedCache
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
  console.log('hwcOptimizedCache 大小:', hwcOptimizedCache.size);

  // Step 5: 检查期号对是否在缓存中
  console.log('\n=== Step 5: 检查期号对缓存匹配 ===');
  let matchedPairs = 0;
  let unmatchedPairs = [];

  for (const pair of issuePairs) {
    const key = `${pair.base_issue}-${pair.target_issue}`;
    if (hwcOptimizedCache.has(key)) {
      matchedPairs++;
    } else {
      unmatchedPairs.push(key);
    }
  }
  console.log('匹配的期号对:', matchedPairs);
  console.log('不匹配的期号对:', unmatchedPairs.length);
  if (unmatchedPairs.length > 0) {
    console.log('不匹配列表（前10个）:', unmatchedPairs.slice(0, 10));
  }

  // Step 6: 检查4:1:0比例是否存在
  console.log('\n=== Step 6: 检查 4:1:0 热温冷比 ===');
  let has410 = 0;
  let no410 = [];

  for (const pair of issuePairs.slice(0, 10)) {  // 只检查前10个
    const key = `${pair.base_issue}-${pair.target_issue}`;
    const hwcMap = hwcOptimizedCache.get(key);
    if (hwcMap) {
      const count = hwcMap.get('4:1:0')?.length || 0;
      if (count > 0) {
        has410++;
        console.log(`  ${key}: 4:1:0=${count}`);
      } else {
        no410.push(key);
        console.log(`  ${key}: 无 4:1:0`);
      }
    } else {
      console.log(`  ${key}: 缓存中不存在`);
    }
  }

  // 关键！检查数据库中的数据格式
  console.log('\n=== Step 7: 检查数据库中的格式 ===');
  const sample = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({ base_issue: '25026', target_issue: '25027' });

  if (sample) {
    console.log('sample.base_issue:', sample.base_issue, '类型:', typeof sample.base_issue);
    console.log('sample.target_issue:', sample.target_issue, '类型:', typeof sample.target_issue);
    console.log('sample.target_id:', sample.target_id, '类型:', typeof sample.target_id);

    // 检查是否与期号对格式匹配
    const firstPair = issuePairs[0];
    console.log('\n期号对格式:');
    console.log('firstPair.base_issue:', firstPair.base_issue, '类型:', typeof firstPair.base_issue);
    console.log('firstPair.target_issue:', firstPair.target_issue, '类型:', typeof firstPair.target_issue);
  }

  mongoose.disconnect();
});
