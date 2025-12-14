const mongoose = require('mongoose');

/**
 * 精确模拟processBatch批次边界问题
 * 诊断为什么25091(批次1最后一期)和25141(批次2最后一期)返回0组合
 */
async function diagnoseBatchBoundary() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  const hwcSchema = new mongoose.Schema({}, { strict: false });
  const HWC = mongoose.model('HWC', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

  // === 模拟任务1配置 ===
  console.log('=== 模拟任务1: 25042-25142 (101期) ===\n');

  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  // === 步骤1: 模拟preloadData ===
  console.log('=== 步骤1: 模拟preloadData ===');

  // 获取目标期号记录
  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log(`目标期号ID范围: ${minID} - ${maxID}, 共${targetRecords.length}条记录`);

  // 使用ID范围查询获取所有记录
  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  console.log(`ID范围查询结果: ${allRecords.length}条记录 (ID ${minID-1} ~ ${maxID})`);

  // 构建映射
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }
  console.log(`idToRecordMap大小: ${idToRecordMap.size}, issueToIdMap大小: ${issueToIdMap.size}`);

  // 生成期号对 (模拟preloadData)
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
  console.log(`生成${issuePairs.length}个期号对 (应该是100或101)`);

  // === 步骤2: 模拟hwcOptimizedCache ===
  console.log('\n=== 步骤2: 模拟hwcOptimizedCache ===');

  const hwcKeys = new Set(issuePairs.map(p => `${p.base_issue}-${p.target_issue}`));
  console.log(`hwcOptimizedCache应有${hwcKeys.size}个key`);

  // 检查关键期号对是否在缓存中
  const criticalPairs = [
    { base: '25090', target: '25091' },  // 批次1最后一期
    { base: '25091', target: '25092' },  // 批次2第一期
    { base: '25140', target: '25141' },  // 批次2最后一期
    { base: '25141', target: '25142' },  // 批次3(推算期)
  ];

  console.log('\n关键期号对在hwcOptimizedCache中的状态:');
  for (const pair of criticalPairs) {
    const key = `${pair.base}-${pair.target}`;
    const inCache = hwcKeys.has(key);
    console.log(`  ${key}: ${inCache ? '✅ 存在' : '❌ 不存在'}`);
  }

  // === 步骤3: 模拟createBatches ===
  console.log('\n=== 步骤3: 模拟批次分割 (batchSize=50) ===');

  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < targetIssues.length; i += batchSize) {
    batches.push(targetIssues.slice(i, i + batchSize));
  }

  console.log(`共${batches.length}个批次:`);
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`  批次${b+1}: ${batch[0]} - ${batch[batch.length-1]} (${batch.length}期)`);
  }

  // === 步骤4: 模拟processBatch中的hwcKey构建 ===
  console.log('\n=== 步骤4: 模拟processBatch的hwcKey构建 ===');

  // 保存第一期的上一期记录 (firstIssuePreviousRecord)
  const firstPair = issuePairs[0];
  const firstIssuePreviousRecord = {
    issue: firstPair.base_issue,
    id: issueToIdMap.get(firstPair.base_issue)
  };
  console.log(`firstIssuePreviousRecord: issue=${firstIssuePreviousRecord.issue}, id=${firstIssuePreviousRecord.id}`);

  // 检查每个批次的边界期号
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(`\n--- 批次${batchIdx + 1} ---`);

    // 构建issueToIDArray (模拟processBatch line 17111-17118)
    const issueToIDArray = batch.map((issue, index) => {
      const issueStr = issue.toString();
      const id = issueToIdMap.get(issueStr);
      return { issue: issueStr, id: id || null, index };
    });

    // 检查批次的第一期和最后一期
    const checkIndices = [0, issueToIDArray.length - 1];

    for (const idx of checkIndices) {
      const { issue: targetIssue, id: targetID } = issueToIDArray[idx];
      let baseIssue, baseID;

      // 模拟line 17128-17166的逻辑
      if (targetID !== null) {
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
          baseIssue = baseRecord.Issue.toString();
          baseID = baseRecord.ID;
        } else if (idx > 0) {
          baseIssue = issueToIDArray[idx - 1].issue;
          baseID = issueToIDArray[idx - 1].id;
        } else if (firstIssuePreviousRecord) {
          baseIssue = firstIssuePreviousRecord.issue;
          baseID = firstIssuePreviousRecord.id;
        }
      } else {
        // 推算期逻辑
        if (idx > 0) {
          baseIssue = issueToIDArray[idx - 1].issue;
          baseID = issueToIDArray[idx - 1].id;
        } else {
          const latestRecord = await DLT.findOne({}).sort({ ID: -1 }).select('Issue ID').lean();
          baseIssue = latestRecord.Issue.toString();
          baseID = latestRecord.ID;
        }
      }

      const hwcKey = `${baseIssue}-${targetIssue}`;
      const inCache = hwcKeys.has(hwcKey);

      const position = idx === 0 ? '第一期' : '最后一期';
      const status = inCache ? '✅ 存在' : '❌ 不存在!';

      console.log(`  ${position} (index=${idx}): targetIssue=${targetIssue}, targetID=${targetID}, baseIssue=${baseIssue} => hwcKey="${hwcKey}" ${status}`);

      if (!inCache) {
        // 检查数据库中是否有这个期号对
        const hwcDoc = await HWC.findOne({
          base_issue: baseIssue,
          target_issue: targetIssue
        }).lean();
        console.log(`    数据库检查: ${hwcDoc ? '✅ 数据库有此期号对' : '❌ 数据库中也没有此期号对'}`);

        // 分析为什么不在缓存中
        const pairInIssuePairs = issuePairs.some(p =>
          p.base_issue === baseIssue && p.target_issue === targetIssue
        );
        console.log(`    issuePairs检查: ${pairInIssuePairs ? '✅ 在issuePairs中' : '❌ 不在issuePairs中'}`);
      }
    }
  }

  await mongoose.disconnect();
}

diagnoseBatchBoundary().catch(e => { console.error(e); process.exit(1); });
