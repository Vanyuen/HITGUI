// 全面诊断：检查任务执行的所有关键点

const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('=== 全面诊断 HWC 任务执行问题 ===\n');

  // 1. 获取最新失败任务的详细结果
  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne(
    { task_id: 'hwc-pos-20251208-0pe' }
  );

  console.log('任务配置:');
  console.log('  task_id:', task.task_id);
  console.log('  热温冷比:', JSON.stringify(task.positive_selection?.red_hot_warm_cold_ratios));
  console.log('  期号范围:', task.period_range?.start, '-', task.period_range?.end);

  // 2. 获取所有结果并检查详细字段
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251208-0pe' })
    .sort({ period: 1 })
    .toArray();

  console.log('\n=== 结果详细分析 ===');
  console.log('总结果数:', results.length);

  // 分类结果
  const categories = {
    hasStep1Count: [],
    noStep1Count: [],
    hasError: [],
    emptyError: []
  };

  for (const r of results) {
    const hasStep1 = r.positive_selection_details?.step1_count !== undefined;
    const hasError = r.error !== undefined;
    const emptyError = r.error === '' || r.error === null;

    if (hasStep1) {
      categories.hasStep1Count.push(r.period);
    } else {
      categories.noStep1Count.push(r.period);
    }

    if (hasError) {
      if (emptyError) {
        categories.emptyError.push({ period: r.period, error: r.error });
      } else {
        categories.hasError.push({ period: r.period, error: r.error });
      }
    }
  }

  console.log('\n有step1_count的期号:', categories.hasStep1Count.length, '个');
  console.log('  期号:', categories.hasStep1Count.slice(0, 5).join(', '), '...');
  console.log('\n无step1_count的期号:', categories.noStep1Count.length, '个');
  console.log('  期号:', categories.noStep1Count.slice(0, 5).join(', '), '...');
  console.log('\n有error字段的结果:', categories.hasError.length, '个');
  if (categories.hasError.length > 0) {
    console.log('  前3个:', categories.hasError.slice(0, 3).map(x => `${x.period}: ${x.error}`).join('\n  '));
  }
  console.log('\nerror为空字符串/null的结果:', categories.emptyError.length, '个');

  // 3. 检查一个有数据和一个无数据结果的完整字段
  console.log('\n=== 详细结果对比 ===');

  const withData = results.find(r => r.positive_selection_details?.step1_count !== undefined);
  const noData = results.find(r => r.positive_selection_details?.step1_count === undefined);

  if (withData) {
    console.log('\n有数据结果 (period=' + withData.period + '):');
    console.log('  所有顶级字段:', Object.keys(withData).join(', '));
    console.log('  positive_selection_details:', JSON.stringify(withData.positive_selection_details, null, 4));
    console.log('  exclusion_summary:', JSON.stringify(withData.exclusion_summary, null, 4));
    console.log('  combination_count:', withData.combination_count);
    console.log('  red_combinations长度:', withData.red_combinations?.length);
    console.log('  error:', withData.error);
  }

  if (noData) {
    console.log('\n无数据结果 (period=' + noData.period + '):');
    console.log('  所有顶级字段:', Object.keys(noData).join(', '));
    console.log('  positive_selection_details:', JSON.stringify(noData.positive_selection_details, null, 4));
    console.log('  exclusion_summary:', JSON.stringify(noData.exclusion_summary, null, 4));
    console.log('  combination_count:', noData.combination_count);
    console.log('  red_combinations长度:', noData.red_combinations?.length);
    console.log('  error:', noData.error);
  }

  // 4. 检查成功任务的结果作为对比
  console.log('\n=== 对比成功任务 sfu ===');
  const sfuResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251208-sfu' })
    .limit(3)
    .toArray();

  for (const r of sfuResults) {
    console.log('period=' + r.period + ':');
    console.log('  step1_count:', r.positive_selection_details?.step1_count);
    console.log('  combination_count:', r.combination_count);
    console.log('  error:', r.error);
  }

  // 5. 检查全局缓存状态（模拟）
  console.log('\n=== 模拟缓存状态检查 ===');

  // 检查红球组合表
  const redCount = await db.collection('hit_dlt_redcombinations').countDocuments();
  console.log('hit_dlt_redcombinations 记录数:', redCount);

  // 检查HWC优化表
  const hwcCount = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();
  console.log('hit_dlt_redcombinationshotwarmcoldoptimizeds 记录数:', hwcCount);

  mongoose.disconnect();
});
