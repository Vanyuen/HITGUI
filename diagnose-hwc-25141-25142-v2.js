const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 检查最新任务
  console.log('=== 最新HWC正选任务 ===');
  const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({}, { sort: { created_at: -1 } });

  console.log('Task ID:', latestTask?.task_id);
  console.log('Status:', latestTask?.status);
  console.log('Created:', latestTask?.created_at);
  console.log('Period Range:', JSON.stringify(latestTask?.period_range));

  // 2. 检查这个任务的25140, 25141, 25142结果
  const taskId = latestTask?.task_id;
  console.log('\n=== 最新任务的25140-25142结果 ===');

  for (const period of [25140, 25141, 25142]) {
    const result = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .findOne({ task_id: taskId, period: period });

    if (result) {
      console.log(`\nPeriod ${period}:`);
      console.log('  is_predicted:', result.is_predicted);
      console.log('  combination_count:', result.combination_count);
      console.log('  red_combinations length:', result.red_combinations?.length);
      console.log('  positive_selection_details:', JSON.stringify(result.positive_selection_details));
    } else {
      console.log(`\nPeriod ${period}: NO RESULT FOUND`);
    }
  }

  // 3. 检查HWC优化表状态
  console.log('\n=== HWC优化表状态 ===');
  const hwcOptimized = db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized');
  const hwcCount = await hwcOptimized.countDocuments();
  console.log('Total records:', hwcCount);

  if (hwcCount > 0) {
    const sample = await hwcOptimized.findOne();
    console.log('Sample record keys:', Object.keys(sample));
    console.log('Sample target_issue:', sample.target_issue);

    // 获取最新的target_issue
    const distinct = await hwcOptimized.distinct('target_issue');
    console.log('Distinct target_issues (last 5):', distinct.slice(-5));
  }

  // 4. 检查hwc_metadatas
  console.log('\n=== HWC元数据 ===');
  const hwcMetadata = await db.collection('hwc_metadatas')
    .find({})
    .sort({ target_issue: -1 })
    .limit(5)
    .toArray();

  hwcMetadata.forEach(m => {
    console.log('Target Issue:', m.target_issue, '- Base Issue:', m.base_issue, '- Count:', m.count);
  });

  await client.close();
}

diagnose().catch(console.error);
