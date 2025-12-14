const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 获取最新任务
  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne(
    { task_id: 'hwc-pos-20251208-0pe' }
  );

  console.log('=== 任务详细信息 ===');
  console.log('task_id:', task.task_id);
  console.log('status:', task.status);
  console.log('progress:', JSON.stringify(task.progress, null, 2));
  console.log('statistics:', JSON.stringify(task.statistics, null, 2));
  console.log('\n=== 期号范围 ===');
  console.log('period_range:', JSON.stringify(task.period_range, null, 2));

  // 检查所有结果的positive_selection_details
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251208-0pe' })
    .sort({ period: 1 })
    .toArray();

  console.log('\n=== 结果分析 ===');
  console.log('总结果数:', results.length);

  // 分类结果
  const categories = {
    hasStep1: 0,
    noStep1: 0,
    hasData: 0,
    noData: 0
  };

  for (const r of results) {
    if (r.positive_selection_details?.step1_count !== undefined) {
      categories.hasStep1++;
    } else {
      categories.noStep1++;
    }
    if (r.combination_count > 0) {
      categories.hasData++;
    } else {
      categories.noData++;
    }
  }

  console.log('有step1_count:', categories.hasStep1);
  console.log('无step1_count:', categories.noStep1);
  console.log('有组合数据:', categories.hasData);
  console.log('无组合数据:', categories.noData);

  // 查看有step1_count的结果
  console.log('\n=== 有step1_count的结果 ===');
  const withStep1 = results.filter(r => r.positive_selection_details?.step1_count !== undefined);
  for (const r of withStep1.slice(0, 5)) {
    console.log('period:', r.period, 'is_predicted:', r.is_predicted,
                'step1:', r.positive_selection_details?.step1_count,
                'final:', r.combination_count);
  }

  // 查看无step1_count的结果
  console.log('\n=== 无step1_count的结果 (前5个) ===');
  const noStep1 = results.filter(r => r.positive_selection_details?.step1_count === undefined);
  for (const r of noStep1.slice(0, 5)) {
    console.log('period:', r.period, 'is_predicted:', r.is_predicted,
                'details:', JSON.stringify(r.positive_selection_details));
  }

  // 检查是否有error字段
  console.log('\n=== 检查error字段 ===');
  const withError = results.filter(r => r.error);
  console.log('有error的结果:', withError.length);
  if (withError.length > 0) {
    console.log('第一个error:', withError[0].error);
  }

  mongoose.disconnect();
});
