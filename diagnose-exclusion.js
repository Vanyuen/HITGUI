// 诊断：检查排除详情数据

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('=== 诊断排除详情数据 ===\n');

  // 1. 获取最新任务
  const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .find({})
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();

  const task = latestTask[0];
  console.log('最新任务:', task.task_id);
  console.log('状态:', task.status);
  console.log('排除详情配置:', JSON.stringify(task.output_config?.exclusion_details, null, 2));

  // 2. 检查该任务的结果
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: task.task_id })
    .limit(5)
    .toArray();

  console.log('\n=== 任务结果示例 ===');
  for (const r of results.slice(0, 3)) {
    console.log(`\n期号 ${r.period}:`);
    console.log('  combination_count:', r.combination_count);
    console.log('  has_exclusion_details:', r.has_exclusion_details);
    console.log('  positive_selection_details keys:', Object.keys(r.positive_selection_details || {}));
    console.log('  exclusion_summary:', JSON.stringify(r.exclusion_summary, null, 4));
  }

  // 3. 检查排除详情表 (DLTExclusionDetails)
  console.log('\n=== 检查排除详情表 ===');

  const exclusionDetails = await db.collection('hit_dlt_exclusiondetails')
    .find({ task_id: task.task_id })
    .toArray();

  console.log('该任务的排除详情记录数:', exclusionDetails.length);

  if (exclusionDetails.length > 0) {
    // 按step分组统计
    const stepCounts = {};
    for (const d of exclusionDetails) {
      stepCounts[d.step] = (stepCounts[d.step] || 0) + 1;
    }
    console.log('按Step分组:', stepCounts);

    // 显示一条示例
    const sample = exclusionDetails[0];
    console.log('\n示例记录:');
    console.log('  period:', sample.period);
    console.log('  step:', sample.step);
    console.log('  condition:', sample.condition);
    console.log('  excluded_count:', sample.excluded_combination_ids?.length || 0);
  }

  // 4. 检查所有排除详情表的结构
  console.log('\n=== 检查排除详情表结构 ===');
  const allExclusions = await db.collection('hit_dlt_exclusiondetails')
    .find({})
    .limit(3)
    .toArray();

  if (allExclusions.length > 0) {
    console.log('表中有数据，字段:', Object.keys(allExclusions[0]));
  } else {
    console.log('❌ 排除详情表为空！');
  }

  // 5. 检查是否有其他相关表
  const collections = await db.listCollections().toArray();
  const exclusionCollections = collections.filter(c =>
    c.name.toLowerCase().includes('exclusion') ||
    c.name.toLowerCase().includes('detail')
  );
  console.log('\n相关集合:', exclusionCollections.map(c => c.name));

  mongoose.disconnect();
});
