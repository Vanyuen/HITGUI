const mongoose = require('mongoose');

/**
 * 直接模拟applyPositiveSelection对期号25091的处理
 */
async function simulateApplyPositiveSelection25091() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const hwcSchema = new mongoose.Schema({}, { strict: false });
  const HWC = mongoose.model('HWC', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

  console.log('=== 模拟applyPositiveSelection ===\n');

  // 目标期号
  const baseIssue = '25090';
  const targetIssue = '25091';
  const hwcKey = `${baseIssue}-${targetIssue}`;

  console.log(`baseIssue=${baseIssue}, targetIssue=${targetIssue}`);
  console.log(`hwcKey="${hwcKey}"`);

  // 模拟正选配置
  const positiveSelection = {
    red_hot_warm_cold_ratios: [{ hot: 3, warm: 1, cold: 1 }]
  };

  // 模拟Step 1: 从HWC优化表获取数据
  console.log('\n=== Step 1: 热温冷比筛选 ===');

  // 从数据库查询HWC数据
  const hwcDoc = await HWC.findOne({
    base_issue: baseIssue,
    target_issue: targetIssue
  }).lean();

  console.log(`数据库查询 base_issue="${baseIssue}", target_issue="${targetIssue}"`);
  console.log(`hwcDoc存在: ${!!hwcDoc}`);

  if (!hwcDoc) {
    console.log('❌ 未找到HWC数据!');
    await mongoose.disconnect();
    return;
  }

  console.log(`hwcDoc._id: ${hwcDoc._id}`);
  console.log(`hwcDoc.hot_warm_cold_data存在: ${!!hwcDoc.hot_warm_cold_data}`);

  // 检查hot_warm_cold_data的键
  if (hwcDoc.hot_warm_cold_data) {
    const keys = Object.keys(hwcDoc.hot_warm_cold_data);
    console.log(`hot_warm_cold_data的键数量: ${keys.length}`);
    console.log(`前10个键: ${keys.slice(0, 10).join(', ')}`);

    // 构建hwcMap
    const hwcMap = new Map();
    for (const [ratio, ids] of Object.entries(hwcDoc.hot_warm_cold_data)) {
      hwcMap.set(ratio, ids);
    }
    console.log(`hwcMap大小: ${hwcMap.size}`);

    // 查找3:1:1
    const selectedRatioKeys = positiveSelection.red_hot_warm_cold_ratios.map(r => {
      if (typeof r === 'string') return r;
      return `${r.hot}:${r.warm}:${r.cold}`;
    });
    console.log(`selectedRatioKeys: ${selectedRatioKeys.join(', ')}`);

    let candidateIds = new Set();
    for (const ratioKey of selectedRatioKeys) {
      const ids = hwcMap.get(ratioKey) || [];
      console.log(`hwcMap.get("${ratioKey}"): ${ids.length}个组合`);
      ids.forEach(id => candidateIds.add(id));
    }

    console.log(`\ncandidateIds大小: ${candidateIds.size}`);
    if (candidateIds.size > 0) {
      console.log(`前10个candidateIds: ${Array.from(candidateIds).slice(0, 10).join(', ')}`);
    }
  }

  // 检查数据库中是否有其他相似的期号对
  console.log('\n=== 检查相似期号对 ===');
  const similarDocs = await HWC.find({
    $or: [
      { base_issue: '25090' },
      { target_issue: '25091' }
    ]
  }).select('base_issue target_issue').lean();

  console.log(`与25090或25091相关的期号对 (${similarDocs.length}个):`);
  similarDocs.forEach(doc => {
    console.log(`  ${doc.base_issue} -> ${doc.target_issue}`);
  });

  await mongoose.disconnect();
}

simulateApplyPositiveSelection25091().catch(e => { console.error(e); process.exit(1); });
