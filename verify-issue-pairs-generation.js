const mongoose = require('mongoose');

/**
 * 完整模拟preloadData的issuePairs生成逻辑
 * 验证25090-25091是否在生成的期号对中
 */
async function verifyIssuePairsGeneration() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  console.log('=== 验证issuePairs生成逻辑 ===\n');

  // 模拟任务1的targetIssues
  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  console.log(`targetIssues: ${targetIssues.length}期 (${targetIssues[0]} - ${targetIssues[targetIssues.length-1]})`);
  console.log(`issueNumbers: ${issueNumbers.length}个 (${issueNumbers[0]} - ${issueNumbers[issueNumbers.length-1]})`);

  // Step 1: 查询所有目标期号获取ID
  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  console.log(`\n=== Step 1: targetRecords ===`);
  console.log(`记录数: ${targetRecords.length}`);
  console.log(`第一条: Issue=${targetRecords[0].Issue}, ID=${targetRecords[0].ID}`);
  console.log(`最后一条: Issue=${targetRecords[targetRecords.length-1].Issue}, ID=${targetRecords[targetRecords.length-1].ID}`);

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log(`ID范围: minID=${minID}, maxID=${maxID}`);

  // Step 2: 使用ID范围查询获取所有记录
  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  console.log(`\n=== Step 2: allRecords (ID范围查询) ===`);
  console.log(`查询: ID >= ${minID - 1} AND ID <= ${maxID}`);
  console.log(`记录数: ${allRecords.length}`);
  console.log(`第一条: Issue=${allRecords[0].Issue}, ID=${allRecords[0].ID}`);
  console.log(`最后一条: Issue=${allRecords[allRecords.length-1].Issue}, ID=${allRecords[allRecords.length-1].ID}`);

  // 构建idToRecordMap
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  console.log(`idToRecordMap大小: ${idToRecordMap.size}`);

  // Step 3: 生成issueRecords
  const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
  console.log(`\n=== Step 3: issueRecords ===`);
  console.log(`记录数: ${issueRecords.length}`);

  // Step 4: 生成issuePairs
  const issuePairs = [];
  const failedPairs = [];

  for (const record of issueRecords) {
    const targetID = record.ID;
    const targetIssue = record.Issue.toString();
    const baseRecord = idToRecordMap.get(targetID - 1);

    if (baseRecord) {
      issuePairs.push({
        base_issue: baseRecord.Issue.toString(),
        target_issue: targetIssue
      });
    } else {
      failedPairs.push({
        targetIssue,
        targetID,
        missingID: targetID - 1
      });
    }
  }

  console.log(`\n=== Step 4: issuePairs生成结果 ===`);
  console.log(`成功生成: ${issuePairs.length}个期号对`);
  console.log(`生成失败: ${failedPairs.length}个`);

  if (failedPairs.length > 0) {
    console.log('生成失败的期号:');
    failedPairs.forEach(f => console.log(`  期号${f.targetIssue} (ID=${f.targetID}): 缺少ID-1 (${f.missingID})`));
  }

  // 检查关键期号对
  console.log('\n=== 检查关键期号对 ===');
  const criticalPairs = [
    { base: '25090', target: '25091' },  // 批次1最后一期
    { base: '25140', target: '25141' },  // 批次2最后一期
    { base: '25141', target: '25142' },  // 推算期
  ];

  for (const pair of criticalPairs) {
    const found = issuePairs.some(p => p.base_issue === pair.base && p.target_issue === pair.target);
    console.log(`${pair.base}->${pair.target}: ${found ? '✅ 存在' : '❌ 不存在'}`);
  }

  // 找出25090->25091在issuePairs中的位置
  const idx25091 = issuePairs.findIndex(p => p.target_issue === '25091');
  console.log(`\n期号对25090->25091的索引: ${idx25091}`);
  if (idx25091 >= 0) {
    console.log(`期号对详情:`, issuePairs[idx25091]);
  }

  await mongoose.disconnect();
}

verifyIssuePairsGeneration().catch(e => { console.error(e); process.exit(1); });
