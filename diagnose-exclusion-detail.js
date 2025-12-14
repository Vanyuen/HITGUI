// 深入诊断：检查排除详情的具体内容

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const taskId = 'hwc-pos-20251209-nsz';

  console.log('=== 深入诊断排除详情 ===\n');

  // 1. 获取该任务所有排除详情
  const allDetails = await db.collection('hit_dlt_exclusiondetails')
    .find({ task_id: taskId })
    .toArray();

  console.log('总排除详情记录数:', allDetails.length);

  // 按期号分组
  const byPeriod = {};
  for (const d of allDetails) {
    if (!byPeriod[d.period]) byPeriod[d.period] = [];
    byPeriod[d.period].push({
      step: d.step,
      condition: d.condition,
      excluded_count: d.excluded_combination_ids?.length || d.excluded_count || 0
    });
  }

  console.log('\n按期号分组:');
  for (const [period, details] of Object.entries(byPeriod)) {
    console.log(`\n期号 ${period}:`);
    for (const d of details) {
      console.log(`  Step ${d.step} (${d.condition}): ${d.excluded_count} 个被排除`);
    }
  }

  // 2. 检查有多少期号有 has_exclusion_details = true
  const resultsWithDetails = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId, has_exclusion_details: true })
    .toArray();

  console.log('\n\n=== has_exclusion_details = true 的期号 ===');
  console.log('数量:', resultsWithDetails.length);
  console.log('期号:', resultsWithDetails.map(r => r.period).join(', '));

  // 3. 检查任务配置
  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({ task_id: taskId });
  console.log('\n=== 任务配置 ===');
  console.log('exclusion_details 配置:', JSON.stringify(task.output_config?.exclusion_details, null, 2));

  // 4. 检查 exclusion_summary 有数据但详情没保存的情况
  console.log('\n=== 检查 exclusion_summary vs 详情保存 ===');
  const sampleResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .findOne({ task_id: taskId, period: 25040 });

  if (sampleResult) {
    console.log('期号 25040 的 exclusion_summary:');
    console.log(JSON.stringify(sampleResult.exclusion_summary, null, 2));

    const details25040 = await db.collection('hit_dlt_exclusiondetails')
      .find({ task_id: taskId, period: '25040' })
      .toArray();
    console.log('\n期号 25040 的排除详情记录数:', details25040.length);
  }

  mongoose.disconnect();
});
