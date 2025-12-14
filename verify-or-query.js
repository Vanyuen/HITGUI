const mongoose = require('mongoose');

/**
 * 验证MongoDB $or查询是否能正确返回所有100个期号对
 */
async function verifyOrQuery() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const hwcSchema = new mongoose.Schema({}, { strict: false });
  const HWC = mongoose.model('HWC', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  console.log('=== 验证$or查询 ===\n');

  // 生成issuePairs (与preloadData逻辑一致)
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;

  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

  const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));

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

  console.log(`生成了${issuePairs.length}个期号对`);

  // 执行$or查询
  console.log(`\n执行$or查询 (${issuePairs.length}个条件)...`);
  const startTime = Date.now();

  const hwcDataList = await HWC.find({
    $or: issuePairs.map(p => ({
      base_issue: p.base_issue,
      target_issue: p.target_issue
    }))
  }).lean();

  const queryTime = Date.now() - startTime;
  console.log(`查询耗时: ${queryTime}ms`);
  console.log(`返回记录数: ${hwcDataList.length}`);

  // 检查是否所有期号对都有对应的HWC数据
  const returnedKeys = new Set(hwcDataList.map(d => `${d.base_issue}-${d.target_issue}`));
  console.log(`返回的唯一key数: ${returnedKeys.size}`);

  // 检查关键期号对
  console.log('\n=== 检查关键期号对在$or查询结果中 ===');
  const criticalPairs = [
    { base: '25090', target: '25091' },
    { base: '25140', target: '25141' },
  ];

  for (const pair of criticalPairs) {
    const key = `${pair.base}-${pair.target}`;
    const found = returnedKeys.has(key);
    console.log(`${key}: ${found ? '✅ 存在' : '❌ 不存在'}`);
  }

  // 构建hwcOptimizedCache并验证
  console.log('\n=== 构建hwcOptimizedCache ===');
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
  console.log(`hwcOptimizedCache大小: ${hwcOptimizedCache.size}`);

  // 测试关键期号对的hwcMap
  console.log('\n=== 测试hwcMap查询 ===');
  for (const pair of criticalPairs) {
    const key = `${pair.base}-${pair.target}`;
    const hwcMap = hwcOptimizedCache.get(key);
    console.log(`hwcOptimizedCache.get("${key}"): ${hwcMap ? `存在 (${hwcMap.size}个比例)` : '不存在'}`);
    if (hwcMap) {
      const ratio311 = hwcMap.get('3:1:1');
      console.log(`  hwcMap.get("3:1:1"): ${ratio311 ? `${ratio311.length}个组合` : '不存在'}`);
    }
  }

  // 找出哪些期号对缺少HWC数据
  console.log('\n=== 检查缺失的期号对 ===');
  const missingPairs = issuePairs.filter(p => {
    const key = `${p.base_issue}-${p.target_issue}`;
    return !returnedKeys.has(key);
  });
  console.log(`缺失HWC数据的期号对: ${missingPairs.length}个`);
  if (missingPairs.length > 0 && missingPairs.length <= 10) {
    missingPairs.forEach(p => console.log(`  ${p.base_issue}->${p.target_issue}`));
  }

  await mongoose.disconnect();
}

verifyOrQuery().catch(e => { console.error(e); process.exit(1); });
