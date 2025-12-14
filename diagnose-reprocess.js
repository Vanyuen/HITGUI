// 诊断：检查保存阶段需要的数据

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const taskId = 'hwc-pos-20251209-nsz';

  console.log('=== 检查重新处理所需数据 ===\n');

  // 1. 获取任务配置
  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({ task_id: taskId });
  console.log('任务 positive_selection:', JSON.stringify(task.positive_selection, null, 2));
  console.log('\n任务 exclusion_conditions:', JSON.stringify(task.exclusion_conditions, null, 2));

  // 2. 检查结果中是否有 base_issue
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId })
    .limit(3)
    .toArray();

  console.log('\n=== 结果中的期号对信息 ===');
  for (const r of results) {
    console.log(`期号 ${r.period}: base_issue 字段存在? ${r.base_issue !== undefined}`);
  }

  // 3. 检查保存阶段传入的参数
  console.log('\n=== saveExclusionDetailsAsync 参数分析 ===');
  console.log('传入参数:');
  console.log('  - taskId: 可以从中获取task配置');
  console.log('  - periodsToSave: 需要保存详情的期号');
  console.log('  - allResults: 包含 base_issue 信息');
  console.log('  - io: Socket.IO实例');

  console.log('\n重新处理所需:');
  console.log('  1. 任务配置 (positive_selection, exclusion_conditions) - 可从task表获取');
  console.log('  2. 期号的 base_issue - 可从 allResults 获取');
  console.log('  3. HwcPositivePredictor 实例 - 需要新建');
  console.log('  4. 全局缓存 - 需要确保可用');

  mongoose.disconnect();
});
