const mongoose = require('mongoose');

async function simulateProcessBatch() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  const hwcSchema = new mongoose.Schema({}, { strict: false });
  const HWC = mongoose.model('HWC', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

  console.log('=== 模拟processBatch缓存逻辑 ===');

  // 1. 模拟预加载后构建的hwcOptimizedCache
  const issuePairs = [
    { base_issue: '25139', target_issue: '25140' },
    { base_issue: '25140', target_issue: '25141' },
    { base_issue: '25141', target_issue: '25142' }
  ];

  const hwcDataList = await HWC.find({
    $or: issuePairs.map(p => ({
      base_issue: p.base_issue,
      target_issue: p.target_issue
    }))
  }).lean();

  console.log('HWC查询返回数:', hwcDataList.length);

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

  console.log('缓存键数:', hwcOptimizedCache.size);
  console.log('缓存键列表:', Array.from(hwcOptimizedCache.keys()));

  // 2. 模拟processBatch中的baseIssue和targetIssue生成
  console.log('\n=== 模拟processBatch期号查找 ===');

  // 处理25140, 25141, 25142
  const issuesBatch = ['25140', '25141', '25142'];

  for (const targetIssue of issuesBatch) {
    const targetRecord = await DLT.findOne({ Issue: parseInt(targetIssue) }).select('Issue ID').lean();
    if (!targetRecord) {
      console.log(`${targetIssue}期: 不在数据库中(推算期)`);

      // 推算期使用最新期号作为基准
      const latestRecord = await DLT.findOne({}).sort({ ID: -1 }).select('Issue ID').lean();
      if (latestRecord) {
        const baseIssue = latestRecord.Issue.toString();
        const hwcKey = `${baseIssue}-${targetIssue}`;
        console.log(`  推算期hwcKey=${hwcKey}`);
        console.log(`  缓存中存在: ${hwcOptimizedCache.has(hwcKey) ? '是' : '否'}`);
      }
      continue;
    }

    const targetID = targetRecord.ID;

    // 查找上一期 (ID - 1)
    const baseRecord = await DLT.findOne({ ID: targetID - 1 }).select('Issue ID').lean();
    if (!baseRecord) {
      console.log(`${targetIssue}期: 找不到上一期`);
      continue;
    }

    // 生成hwcKey（关键！）
    const baseIssue = baseRecord.Issue.toString();
    const hwcKey = `${baseIssue}-${targetIssue}`;

    console.log(`${targetIssue}期: baseIssue=${baseIssue} (ID=${baseRecord.ID})`);
    console.log(`  hwcKey=${hwcKey}, 类型=${typeof hwcKey}`);
    console.log(`  缓存中存在: ${hwcOptimizedCache.has(hwcKey) ? '是' : '否'}`);

    if (hwcOptimizedCache.has(hwcKey)) {
      const hwcMap = hwcOptimizedCache.get(hwcKey);
      const ids_311 = hwcMap.get('3:1:1') || [];
      console.log(`  3:1:1组合数: ${ids_311.length}`);
    }
  }

  await mongoose.disconnect();
}

simulateProcessBatch().catch(e => { console.error(e); process.exit(1); });
