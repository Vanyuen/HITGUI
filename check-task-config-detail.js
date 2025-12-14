const mongoose = require('mongoose');

/**
 * 检查任务的positive_selection配置
 */
async function checkTaskConfigDetail() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const taskSchema = new mongoose.Schema({}, { strict: false });
  const Task = mongoose.model('Task', taskSchema, 'hit_dlt_hwcpositivepredictiontasks');

  // 检查两个任务的配置
  const task1 = await Task.findOne({ task_id: 'hwc-pos-20251213-ykt' }).lean();
  const task2 = await Task.findOne({ task_id: 'hwc-pos-20251213-7pg' }).lean();

  console.log('=== 任务1配置 (hwc-pos-20251213-ykt) ===');
  console.log('positive_selection:', JSON.stringify(task1?.positive_selection, null, 2));

  console.log('\n=== 任务2配置 (hwc-pos-20251213-7pg) ===');
  console.log('positive_selection:', JSON.stringify(task2?.positive_selection, null, 2));

  // 检查字段名
  console.log('\n=== 字段名检查 ===');
  if (task1?.positive_selection) {
    console.log('任务1 positive_selection 的所有字段:', Object.keys(task1.positive_selection));
    console.log('red_hot_warm_cold_ratios:', task1.positive_selection.red_hot_warm_cold_ratios);
  }

  await mongoose.disconnect();
}

checkTaskConfigDetail().catch(e => { console.error(e); process.exit(1); });
