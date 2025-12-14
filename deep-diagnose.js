// 深度诊断：检查最新HWC任务的完整状态

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('=== 深度诊断 HWC 任务 ===\n');

  // 1. 获取最新任务
  const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .find({})
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();

  if (latestTask.length === 0) {
    console.log('❌ 没有找到任务');
    mongoose.disconnect();
    return;
  }

  const task = latestTask[0];
  console.log('最新任务:');
  console.log('  task_id:', task.task_id);
  console.log('  status:', task.status);
  console.log('  created_at:', task.created_at);
  console.log('  期号范围:', task.period_range?.start, '-', task.period_range?.end);

  // 2. 获取该任务的所有结果
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: task.task_id })
    .sort({ period: 1 })
    .toArray();

  console.log('\n=== 结果统计 ===');
  console.log('总结果数:', results.length);

  // 3. 分析结果模式
  let withData = 0;
  let withoutData = 0;
  let withError = 0;
  let errorMessages = [];

  for (const r of results) {
    const hasStep1 = r.positive_selection_details?.step1_count !== undefined;
    const hasError = r.error && r.error.length > 0;

    if (hasStep1 && r.combination_count > 0) {
      withData++;
    } else {
      withoutData++;
    }

    if (hasError) {
      withError++;
      if (!errorMessages.includes(r.error)) {
        errorMessages.push(r.error);
      }
    }
  }

  console.log('有数据的结果:', withData);
  console.log('无数据的结果:', withoutData);
  console.log('有错误的结果:', withError);

  if (errorMessages.length > 0) {
    console.log('\n错误信息:');
    for (const msg of errorMessages) {
      console.log('  -', msg);
    }
  }

  // 4. 检查第一个有数据和第一个无数据的详细对比
  const firstWithData = results.find(r => r.positive_selection_details?.step1_count !== undefined && r.combination_count > 0);
  const firstWithoutData = results.find(r => r.positive_selection_details?.step1_count === undefined || r.combination_count === 0);

  if (firstWithData) {
    console.log('\n=== 有数据结果示例 (period=' + firstWithData.period + ') ===');
    console.log('  combination_count:', firstWithData.combination_count);
    console.log('  is_predicted:', firstWithData.is_predicted);
    console.log('  positive_selection_details:', JSON.stringify(firstWithData.positive_selection_details, null, 2));
    console.log('  error:', firstWithData.error || '(无)');
  }

  if (firstWithoutData) {
    console.log('\n=== 无数据结果示例 (period=' + firstWithoutData.period + ') ===');
    console.log('  combination_count:', firstWithoutData.combination_count);
    console.log('  is_predicted:', firstWithoutData.is_predicted);
    console.log('  positive_selection_details:', JSON.stringify(firstWithoutData.positive_selection_details, null, 2));
    console.log('  error:', firstWithoutData.error || '(无)');
  }

  // 5. 检查是否有新的错误信息被记录
  const resultsWithNewError = results.filter(r => r.error && r.error.includes('缓存'));
  console.log('\n包含"缓存"关键字的错误:', resultsWithNewError.length);

  mongoose.disconnect();
});
