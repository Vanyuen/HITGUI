const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 检查 hit_dlt_hwcpositivepredictiontaskresults 集合...\n');

  // 第一个任务
  const taskId1 = 'hwc-pos-20251121-b6s';
  const results1 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId1 })
    .sort({ period: 1 })
    .toArray();

  console.log(`【任务1】 ${taskId1}`);
  console.log(`  结果数量: ${results1.length}期\n`);

  if (results1.length > 0) {
    console.log(`  全部期号数据:`);
    results1.forEach(r => {
      const redCount = r.retained_combinations?.red_combinations?.length || 0;
      const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
      const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
      const isPredicted = r.is_predicted ? '推算' : '已开奖';

      console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
    });
  }

  console.log('\n---\n');

  // 第二个任务
  const taskId2 = 'hwc-pos-20251121-t37';
  const results2 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId2 })
    .sort({ period: 1 })
    .toArray();

  console.log(`【任务2】 ${taskId2}`);
  console.log(`  结果数量: ${results2.length}期\n`);

  if (results2.length > 0) {
    console.log(`  全部期号数据:`);
    results2.forEach(r => {
      const redCount = r.retained_combinations?.red_combinations?.length || 0;
      const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
      const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
      const isPredicted = r.is_predicted ? '推算' : '已开奖';

      console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
    });
  }

  console.log('\n🔍 对比分析:\n');

  const task1Predicted = results1.filter(r => r.is_predicted);
  const task2Predicted = results2.filter(r => r.is_predicted);

  console.log(`任务1: ${task1Predicted.length}/${results1.length} 期被标记为推算期`);
  console.log(`任务2: ${task2Predicted.length}/${results2.length} 期被标记为推算期`);

  console.log('\n✅ 结论:');
  if (task1Predicted.length === 1 && task2Predicted.length > 1) {
    console.log('  ❌ BUG确认: 第二个任务将大量已开奖期误判为推算期！');
  } else if (task1Predicted.length === task2Predicted.length) {
    console.log('  ⚠️ 两个任务推算期数量相同，可能前端显示问题');
  }

  await mongoose.connection.close();
}).catch(console.error);
