const mongoose = require('mongoose');

/**
 * 检查任务1的实际结果中哪些期号返回0组合
 */
async function checkActualResults() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const resultSchema = new mongoose.Schema({}, { strict: false });
  const Result = mongoose.model('Result', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

  // 任务1的ID
  const taskId = 'hwc-pos-20251213-ykt';

  console.log(`=== 检查任务 ${taskId} 的结果 ===\n`);

  // 获取所有结果
  const allResults = await Result.find({ task_id: taskId })
    .sort({ period: 1 })
    .lean();

  console.log(`总结果数: ${allResults.length}`);

  // 找出combination_count为0的期号
  const zeroResults = allResults.filter(r => r.combination_count === 0);
  console.log(`\ncombination_count为0的期号 (共${zeroResults.length}期):`);

  for (const r of zeroResults) {
    console.log(`  期号${r.period}: combination_count=${r.combination_count}, is_predicted=${r.is_predicted}`);
    if (r.positive_selection_details) {
      console.log(`    positive_selection_details: ${JSON.stringify(r.positive_selection_details)}`);
    }
    if (r.error) {
      console.log(`    error: ${r.error}`);
    }
  }

  // 检查批次边界附近的结果
  const boundaryPeriods = [25090, 25091, 25092, 25139, 25140, 25141, 25142];
  console.log('\n=== 批次边界附近的结果 ===');

  for (const period of boundaryPeriods) {
    const result = allResults.find(r => r.period === period);
    if (result) {
      console.log(`期号${period}: combination_count=${result.combination_count}, is_predicted=${result.is_predicted}`);
      if (result.positive_selection_details) {
        const ps = result.positive_selection_details;
        console.log(`  step1_count=${ps.step1_count || 0}, step2_retained_count=${ps.step2_retained_count || 0}`);
      }
    } else {
      console.log(`期号${period}: 无结果`);
    }
  }

  // 检查任务2作为对比
  console.log('\n=== 检查任务2 (hwc-pos-20251213-7pg) 的结果作对比 ===');
  const task2Id = 'hwc-pos-20251213-7pg';
  const task2Results = await Result.find({ task_id: task2Id })
    .sort({ period: 1 })
    .lean();

  console.log(`任务2总结果数: ${task2Results.length}`);

  for (const period of boundaryPeriods) {
    const result = task2Results.find(r => r.period === period);
    if (result) {
      console.log(`期号${period}: combination_count=${result.combination_count}, is_predicted=${result.is_predicted}`);
      if (result.positive_selection_details) {
        const ps = result.positive_selection_details;
        console.log(`  step1_count=${ps.step1_count || 0}`);
      }
    }
  }

  await mongoose.disconnect();
}

checkActualResults().catch(e => { console.error(e); process.exit(1); });
