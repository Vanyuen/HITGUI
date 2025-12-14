const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 检查25140, 25141, 25142的结果
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ period: { $in: [25140, 25141, 25142] } })
    .sort({ period: 1 })
    .toArray();

  console.log('=== 25140-25142期结果对比 ===');
  results.forEach(r => {
    console.log('\nPeriod:', r.period);
    console.log('  is_predicted:', r.is_predicted);
    console.log('  combination_count:', r.combination_count);
    console.log('  step1_base_ids count:', r.positive_selection_details?.step1_base_combination_ids?.length || 0);
  });

  // 检查HWC优化表中这几期的数据
  console.log('\n=== 检查HWC优化表数据 ===');
  const hwcOptimized = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');

  for (const issue of [25140, 25141, 25142]) {
    const count = await hwcOptimized.countDocuments({
      target_issue: String(issue)
    });
    console.log('Target Issue', issue, ':', count, 'records');
  }

  // 检查最新的HWC优化表数据
  const latestHwc = await hwcOptimized
    .find({})
    .sort({ target_issue: -1 })
    .limit(1)
    .toArray();
  console.log('\nLatest HWC Optimized record target_issue:', latestHwc[0]?.target_issue);

  // 检查25141期的正选结果详情
  console.log('\n=== 25141期详细结果 ===');
  const result25141 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .findOne({ period: 25141 });
  if (result25141) {
    console.log('positive_selection_details:', JSON.stringify(result25141.positive_selection_details, null, 2));
    console.log('exclusion_summary:', JSON.stringify(result25141.exclusion_summary, null, 2));
  }

  // 检查25140期的正选结果详情
  console.log('\n=== 25140期详细结果 ===');
  const result25140 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .findOne({ period: 25140 });
  if (result25140) {
    console.log('combination_count:', result25140.combination_count);
    console.log('step1_base_ids count:', result25140.positive_selection_details?.step1_base_combination_ids?.length);
    console.log('red_combinations count:', result25140.red_combinations?.length);
  }

  await client.close();
}

diagnose().catch(console.error);
