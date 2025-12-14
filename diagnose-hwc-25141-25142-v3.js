const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 检查实际使用的集合
  console.log('=== 检查热温冷相关集合 ===');
  const hwcCollections = [
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    'hit_dlt_redcombinationshotwarmcoldoptimized',
    'DLTRedCombinationsHotWarmColdOptimized'
  ];

  for (const coll of hwcCollections) {
    const count = await db.collection(coll).countDocuments();
    console.log(`${coll}: ${count} records`);
    if (count > 0) {
      const sample = await db.collection(coll).findOne();
      console.log('  Sample keys:', Object.keys(sample));
      console.log('  Sample base_issue:', sample.base_issue);
      console.log('  Sample target_issue:', sample.target_issue);
    }
  }

  // 2. 检查任务的执行日志
  console.log('\n=== 查看最新任务创建时间和处理时间 ===');
  const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({}, { sort: { created_at: -1 } });

  if (latestTask) {
    console.log('Task ID:', latestTask.task_id);
    console.log('Created:', latestTask.created_at);
    console.log('Completed:', latestTask.completed_at);
  }

  // 3. 检查25140期对应的结果数量（看是否有多个任务的结果）
  console.log('\n=== 25140期所有任务结果 ===');
  const results25140 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ period: 25140 })
    .sort({ created_at: -1 })
    .toArray();

  console.log('Total 25140 results:', results25140.length);
  results25140.forEach((r, idx) => {
    console.log(`  [${idx}] task_id: ${r.task_id}, count: ${r.combination_count}, created: ${r.created_at}`);
  });

  // 4. 检查最新任务的25140结果和25141结果的创建时间差异
  const taskId = latestTask?.task_id;
  if (taskId) {
    console.log('\n=== 最新任务的各期结果时间戳 ===');
    const taskResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: taskId, period: { $in: [25139, 25140, 25141, 25142] } })
      .sort({ period: 1 })
      .toArray();

    taskResults.forEach(r => {
      console.log(`  Period ${r.period}: count=${r.combination_count}, created=${r.created_at}`);
    });
  }

  await client.close();
}

diagnose().catch(console.error);
