// 诊断：直接测试 HwcPositivePredictor 的行为

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  console.log('=== 诊断 HwcPositivePredictor ===\n');

  const db = mongoose.connection.db;

  // 获取失败任务的配置
  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne(
    { task_id: 'hwc-pos-20251208-0pe' }
  );

  console.log('任务配置:');
  console.log('  热温冷比:', JSON.stringify(task.positive_selection?.red_hot_warm_cold_ratios));
  console.log('  期号范围:', task.period_range?.start, '-', task.period_range?.end);

  // 模拟检查：确认HWC优化表有数据
  console.log('\n=== 检查HWC优化表数据 ===');
  const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({ base_issue: '25026', target_issue: '25027' });

  if (hwcData) {
    console.log('期号对 25026->25027 存在');
    console.log('  target_id:', hwcData.target_id);
    const keys = Object.keys(hwcData.hot_warm_cold_data || {});
    console.log('  热温冷比keys:', keys.slice(0, 5).join(', '), '...');
    console.log('  4:1:0 组合数:', hwcData.hot_warm_cold_data?.['4:1:0']?.length || 0);
  } else {
    console.log('⚠️ 期号对 25026->25027 不存在!');
  }

  // 检查服务器日志中是否有相关错误
  console.log('\n=== 检查任务状态 ===');
  console.log('  status:', task.status);
  console.log('  error:', task.error);
  console.log('  started_at:', task.started_at);
  console.log('  completed_at:', task.completed_at);

  // 分析结果中的详细字段
  console.log('\n=== 分析结果字段模式 ===');
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251208-0pe' })
    .toArray();

  // 统计不同的positive_selection_details模式
  const patterns = {};
  for (const r of results) {
    const keys = Object.keys(r.positive_selection_details || {}).sort().join(',');
    if (!patterns[keys]) {
      patterns[keys] = { count: 0, sample_period: r.period };
    }
    patterns[keys].count++;
  }

  console.log('\npositive_selection_details 字段模式:');
  for (const [keys, info] of Object.entries(patterns)) {
    console.log(`  "${keys}": ${info.count}个 (示例期号: ${info.sample_period})`);
  }

  // 检查有无error字段的分布
  const withError = results.filter(r => r.error !== undefined && r.error !== null && r.error !== '');
  const withoutError = results.filter(r => r.error === undefined || r.error === null || r.error === '');

  console.log('\nerror字段分布:');
  console.log('  有error:', withError.length);
  console.log('  无error:', withoutError.length);

  if (withError.length > 0) {
    console.log('\n有error的结果示例:');
    for (const r of withError.slice(0, 3)) {
      console.log(`  期号${r.period}: "${r.error}"`);
    }
  }

  // 对比成功任务
  console.log('\n=== 对比成功任务 sfu ===');
  const sfuResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: 'hwc-pos-20251208-sfu' })
    .limit(5)
    .toArray();

  const sfuPatterns = {};
  for (const r of sfuResults) {
    const keys = Object.keys(r.positive_selection_details || {}).sort().join(',');
    if (!sfuPatterns[keys]) {
      sfuPatterns[keys] = { count: 0, sample_period: r.period };
    }
    sfuPatterns[keys].count++;
  }

  console.log('positive_selection_details 字段模式:');
  for (const [keys, info] of Object.entries(sfuPatterns)) {
    console.log(`  "${keys}": ${info.count}个 (示例期号: ${info.sample_period})`);
  }

  mongoose.disconnect();
});
