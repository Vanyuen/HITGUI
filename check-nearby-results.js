const mongoose = require('mongoose');

async function checkNearbyResults() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  const resultSchema = new mongoose.Schema({}, { strict: false });
  const Result = mongoose.model('Result', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

  // 检查任务1中25135-25142的结果
  console.log('=== 任务1 (hwc-pos-20251213-ykt) 最后8期结果 ===');
  const results = await Result.find({
    task_id: 'hwc-pos-20251213-ykt',
    period: { $gte: 25135, $lte: 25142 }
  }).sort({ period: 1 }).lean();

  for (const r of results) {
    console.log(`期号${r.period}: combination_count=${r.combination_count}, red_count=${r.red_combinations?.length || 0}, is_predicted=${r.is_predicted}`);
  }

  // 检查任务1从期号25090开始的结果（批次边界附近）
  console.log('\n=== 检查批次边界 (25090-25100) ===');
  const boundary = await Result.find({
    task_id: 'hwc-pos-20251213-ykt',
    period: { $gte: 25090, $lte: 25100 }
  }).sort({ period: 1 }).lean();

  for (const r of boundary) {
    console.log(`期号${r.period}: ${r.combination_count}个组合`);
  }

  // 统计任务1中combination_count为0的期号
  console.log('\n=== 任务1中combination_count为0的期号 ===');
  const zeroResults = await Result.find({
    task_id: 'hwc-pos-20251213-ykt',
    combination_count: 0
  }).sort({ period: 1 }).lean();

  console.log(`共${zeroResults.length}期`);
  const zeroPeriods = zeroResults.map(r => r.period).join(', ');
  console.log(`期号列表: ${zeroPeriods}`);

  await mongoose.disconnect();
}

checkNearbyResults().catch(e => { console.error(e); process.exit(1); });
