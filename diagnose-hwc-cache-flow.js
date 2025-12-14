// 诊断：检查HWC任务执行时的缓存状态
const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  console.log('=== 诊断：模拟HWC任务执行流程 ===\n');

  // 模拟任务期号范围：25042-25142（101期）
  const issueNumbers = [];
  for (let i = 25042; i <= 25142; i++) {
    issueNumbers.push(i);
  }
  console.log('目标期号范围:', issueNumbers[0], '-', issueNumbers[issueNumbers.length - 1], '(', issueNumbers.length, '期)');

  // Step 1: 查询目标期号
  const targetRecords = await db.collection('hit_dlts')
    .find({ Issue: { $in: issueNumbers } })
    .sort({ ID: 1 })
    .toArray();
  console.log('\n[Step 1] 数据库中存在的期号:', targetRecords.length, '个');
  console.log('  最后3期:', targetRecords.slice(-3).map(r => `${r.Issue}(ID:${r.ID})`).join(', '));

  // Step 2: 计算ID范围并查询
  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log('\n[Step 2] ID范围:', minID - 1, '-', maxID);

  const allRecords = await db.collection('hit_dlts')
    .find({ ID: { $gte: minID - 1, $lte: maxID } })
    .sort({ ID: 1 })
    .toArray();
  console.log('  allRecords数量:', allRecords.length);

  // Step 3: 构建映射
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  // Step 4: 生成期号对（已开奖期号）
  const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
  const issuePairs = [];
  for (const record of issueRecords) {
    const baseRecord = idToRecordMap.get(record.ID - 1);
    if (baseRecord) {
      issuePairs.push({
        base_issue: baseRecord.Issue.toString(),
        target_issue: record.Issue.toString()
      });
    }
  }
  console.log('\n[Step 4] 已开奖期号对:', issuePairs.length, '个');
  console.log('  最后3个:', issuePairs.slice(-3).map(p => p.base_issue + '->' + p.target_issue).join(', '));

  // Step 5: 识别推算期并添加期号对
  const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
  const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
  console.log('\n[Step 5] 推算期:', predictedIssues);

  if (predictedIssues.length > 0) {
    const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
    const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);
    for (const predictedIssue of predictedIssues) {
      issuePairs.push({
        base_issue: maxRecord.Issue.toString(),
        target_issue: predictedIssue.toString()
      });
    }
    console.log('  添加推算期期号对:', maxRecord.Issue + '->' + predictedIssues[0]);
  }

  console.log('\n[总计] 期号对总数:', issuePairs.length);

  // Step 6: 查询HWC优化表
  console.log('\n[Step 6] 查询HWC优化表...');
  const query = {
    $or: issuePairs.map(p => ({
      base_issue: p.base_issue,
      target_issue: p.target_issue
    }))
  };

  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .find(query)
    .toArray();
  console.log('  查询到的记录数:', hwcDataList.length);

  // Step 7: 构建缓存并检查关键期号
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
  console.log('  hwcOptimizedCache大小:', hwcOptimizedCache.size);

  // 检查关键期号对
  console.log('\n[Step 7] 检查关键期号对:');
  const testKeys = ['25139-25140', '25140-25141', '25141-25142'];
  for (const key of testKeys) {
    const cached = hwcOptimizedCache.get(key);
    if (cached) {
      const ratio311 = cached.get('3:1:1') || [];
      console.log(`  ${key}: ✅ 找到 (3:1:1=${ratio311.length}个组合)`);
    } else {
      console.log(`  ${key}: ❌ 未找到`);
    }
  }

  // Step 8: 如果有缺失，检查原因
  const missingPairs = issuePairs.filter(p => !hwcOptimizedCache.has(`${p.base_issue}-${p.target_issue}`));
  if (missingPairs.length > 0) {
    console.log('\n[Step 8] 缺失的期号对:', missingPairs.length, '个');
    console.log('  示例:', missingPairs.slice(0, 5).map(p => p.base_issue + '->' + p.target_issue).join(', '));

    // 检查数据库中是否存在这些期号对
    for (const p of missingPairs.slice(0, 3)) {
      const exists = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: p.base_issue, target_issue: p.target_issue });
      console.log(`  检查 ${p.base_issue}->${p.target_issue}: ${exists ? '数据库有' : '数据库无'}`);
    }
  }

  await client.close();
}

diagnose().catch(console.error);
