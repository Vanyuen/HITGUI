const mongoose = require('mongoose');

async function checkLatestTask() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

  // 获取最新任务
  const latestTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({}, { sort: { created_at: -1 } });

  console.log('=== 最新任务 ===');
  console.log('task_id:', latestTask?.task_id);
  console.log('created_at:', latestTask?.created_at);
  console.log('period_range:', JSON.stringify(latestTask?.period_range, null, 2));
  console.log('status:', latestTask?.status);

  // 获取该任务的推算期结果
  const taskId = latestTask?.task_id;
  if (taskId) {
    // 获取所有结果按period排序
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
      .find({ task_id: taskId })
      .sort({ period: -1 })
      .limit(5)
      .toArray();

    console.log('\n=== 最后5期结果 ===');
    results.forEach(r => {
      console.log(`期号${r.period}: is_predicted=${r.is_predicted}, combinations=${r.combination_count}, red_combos=${r.red_combinations?.length || 0}`);
    });

    // 特别检查推算期
    const predictedPeriod = latestTask?.period_range?.end;
    if (predictedPeriod) {
      const predictedResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: taskId, period: parseInt(predictedPeriod) });

      console.log('\n=== 推算期详情 ===');
      console.log('期号:', predictedPeriod);
      if (predictedResult) {
        console.log('is_predicted:', predictedResult.is_predicted);
        console.log('combination_count:', predictedResult.combination_count);
        console.log('red_combinations长度:', predictedResult.red_combinations?.length);
        console.log('positive_selection_details:', JSON.stringify(predictedResult.positive_selection_details, null, 2));
      } else {
        console.log('未找到结果记录');
      }
    }
  }

  await mongoose.disconnect();
}
checkLatestTask().catch(console.error);
