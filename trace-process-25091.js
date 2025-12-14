const mongoose = require('mongoose');

/**
 * 精确模拟processBatch处理期号25091的流程
 * 重点：检查idToRecordMap是否正确包含ID 2758（25090对应的ID-1）
 */
async function traceProcess25091() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const dltSchema = new mongoose.Schema({}, { strict: false });
  const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

  const hwcSchema = new mongoose.Schema({}, { strict: false });
  const HWC = mongoose.model('HWC', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

  console.log('=== 追踪期号25091的处理过程 ===\n');

  // 获取25091的ID
  const record25091 = await DLT.findOne({ Issue: 25091 }).lean();
  console.log(`期号25091: ID=${record25091?.ID}`);

  // 获取ID-1对应的记录
  const baseRecord = await DLT.findOne({ ID: record25091.ID - 1 }).lean();
  console.log(`ID-1 (${record25091.ID - 1}): Issue=${baseRecord?.Issue}`);

  // 模拟任务1的preloadData
  console.log('\n=== 模拟preloadData (任务1: 25042-25142) ===');

  const targetIssues = [];
  for (let i = 25042; i <= 25142; i++) {
    targetIssues.push(i.toString());
  }
  const issueNumbers = targetIssues.map(i => parseInt(i));

  // 查询目标期号记录
  const targetRecords = await DLT.find({ Issue: { $in: issueNumbers } })
    .select('Issue ID')
    .sort({ ID: 1 })
    .lean();

  const minID = targetRecords[0].ID;
  const maxID = targetRecords[targetRecords.length - 1].ID;
  console.log(`targetRecords: ${targetRecords.length}条，ID范围 ${minID}-${maxID}`);

  // ID范围查询
  const allRecords = await DLT.find({
    ID: { $gte: minID - 1, $lte: maxID }
  }).select('Issue ID').sort({ ID: 1 }).lean();

  console.log(`allRecords: ${allRecords.length}条，ID范围 ${allRecords[0].ID}-${allRecords[allRecords.length-1].ID}`);

  // 构建idToRecordMap
  const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
  console.log(`idToRecordMap大小: ${idToRecordMap.size}`);

  // 检查关键ID是否在map中
  const criticalIDs = [2757, 2758, 2759, 2807, 2808, 2809];
  console.log('\n关键ID在idToRecordMap中:');
  for (const id of criticalIDs) {
    const record = idToRecordMap.get(id);
    console.log(`  ID ${id}: ${record ? `Issue=${record.Issue}` : '不存在!'}`);
  }

  // 构建issueToIdMap
  const issueToIdMap = new Map();
  for (const record of allRecords) {
    issueToIdMap.set(record.Issue.toString(), record.ID);
  }
  console.log(`issueToIdMap大小: ${issueToIdMap.size}`);

  // 模拟批次1的issuesBatch
  console.log('\n=== 模拟批次1处理 (25042-25091) ===');

  const batch1 = targetIssues.slice(0, 50);  // 前50期
  console.log(`批次1: ${batch1[0]} - ${batch1[batch1.length-1]} (${batch1.length}期)`);

  // 构建issueToIDArray
  const issueToIDArray = batch1.map((issue, index) => {
    const issueStr = issue.toString();
    const id = issueToIdMap.get(issueStr);
    return { issue: issueStr, id: id || null, index };
  });

  // 处理最后一期 (index=49, 期号25091)
  const lastIdx = issueToIDArray.length - 1;
  const { issue: targetIssue, id: targetID } = issueToIDArray[lastIdx];

  console.log(`\n--- 处理批次1最后一期 (index=${lastIdx}) ---`);
  console.log(`targetIssue=${targetIssue}, targetID=${targetID}`);

  if (targetID !== null) {
    console.log(`  情况1: targetID存在，查找ID-1 (${targetID - 1})...`);
    const baseRec = idToRecordMap.get(targetID - 1);

    if (baseRec) {
      console.log(`  ✅ baseRecord找到: Issue=${baseRec.Issue}, ID=${baseRec.ID}`);
      const hwcKey = `${baseRec.Issue}-${targetIssue}`;
      console.log(`  hwcKey="${hwcKey}"`);

      // 检查HWC数据库是否有这个期号对
      const hwcDoc = await HWC.findOne({
        base_issue: baseRec.Issue.toString(),
        target_issue: targetIssue.toString()
      }).lean();
      console.log(`  数据库HWC数据: ${hwcDoc ? '存在' : '不存在'}`);

      if (hwcDoc && hwcDoc.hot_warm_cold_data) {
        const ratio311 = hwcDoc.hot_warm_cold_data['3:1:1'];
        console.log(`  比例3:1:1的组合数: ${ratio311?.length || 0}`);
      }
    } else {
      console.log(`  ❌ baseRecord不存在! idToRecordMap没有ID ${targetID - 1}`);
      console.log(`  检查idToRecordMap的ID范围...`);

      const allIDs = Array.from(idToRecordMap.keys()).sort((a, b) => a - b);
      console.log(`  idToRecordMap ID范围: ${allIDs[0]} - ${allIDs[allIDs.length - 1]}`);
      console.log(`  目标ID ${targetID - 1} 是否在范围内: ${targetID - 1 >= allIDs[0] && targetID - 1 <= allIDs[allIDs.length - 1]}`);
    }
  } else {
    console.log(`  情况2: targetID为null (推算期)`);
  }

  await mongoose.disconnect();
}

traceProcess25091().catch(e => { console.error(e); process.exit(1); });
