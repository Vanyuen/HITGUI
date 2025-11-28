const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 检查热温冷正选任务列表...\n');

  const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .find({})
    .sort({ created_at: -1 })
    .limit(5)
    .toArray();

  console.log(`找到 ${tasks.length} 个任务:\n`);

  for (const task of tasks) {
    console.log(`任务ID: ${task.task_id}`);
    console.log(`  状态: ${task.status}`);
    console.log(`  期号范围: ${task.period_range?.start} - ${task.period_range?.end}`);
    console.log(`  总期数: ${task.period_range?.total}`);
    console.log(`  推算期数: ${task.period_range?.predicted_count || 0}`);
    console.log(`  创建时间: ${new Date(task.created_at).toLocaleString('zh-CN')}`);

    // 检查热温冷比
    const hwcRatios = task.positive_selection?.red_hot_warm_cold_ratios;
    if (hwcRatios && hwcRatios.length > 0) {
      const ratiosText = hwcRatios.map(r => `${r.hot}:${r.warm}:${r.cold}`).join(', ');
      console.log(`  热温冷比: ${ratiosText}`);
    }

    console.log('');
  }

  // 重点检查最新的两个任务
  if (tasks.length >= 2) {
    console.log('\n📊 对比最新两个任务的结果数据...\n');

    for (let i = 0; i < 2; i++) {
      const task = tasks[i];
      console.log(`【任务${i+1}】 ${task.task_id}`);

      // 检查结果集合
      const resultCollectionName = task.result_collection;
      console.log(`  结果集合: ${resultCollectionName || '未设置'}`);

      if (resultCollectionName) {
        // 检查结果数据
        const results = await db.collection(resultCollectionName)
          .find({})
          .sort({ period: 1 })
          .limit(15)
          .toArray();

        console.log(`  结果总数: ${results.length}期`);
        console.log(`  前15期数据:`);

        results.forEach(r => {
          const redCount = r.retained_combinations?.red_combinations?.length || 0;
          const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
          const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
          const isPredicted = r.is_predicted ? '推算' : '已开奖';

          console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
        });
      }

      console.log('');
    }
  }

  await mongoose.connection.close();
}).catch(console.error);
