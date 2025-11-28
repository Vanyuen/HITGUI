const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const taskId = 'hwc-pos-20251121-b6s';

  console.log(`\n🔍 检查任务 ${taskId} 的完整结构...\n`);

  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({ task_id: taskId });

  if (!task) {
    console.log('❌ 未找到任务');
    await mongoose.connection.close();
    return;
  }

  console.log('📋 任务字段结构:');
  console.log(JSON.stringify(Object.keys(task), null, 2));

  console.log('\n📊 task_results 字段:');
  if (task.task_results && task.task_results.length > 0) {
    console.log(`  类型: 数组`);
    console.log(`  长度: ${task.task_results.length}`);

    console.log(`\n  前15期数据:`);
    task.task_results.slice(0, 15).forEach(r => {
      const redCount = r.retained_combinations?.red_combinations?.length || 0;
      const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
      const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
      const isPredicted = r.is_predicted ? '推算' : '已开奖';

      console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
    });
  } else {
    console.log('  ❌ 字段不存在或为空');
  }

  console.log('\n🔍 检查第二个任务...\n');

  const taskId2 = 'hwc-pos-20251121-t37';
  const task2 = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({ task_id: taskId2 });

  if (task2 && task2.task_results && task2.task_results.length > 0) {
    console.log(`【任务2】 ${taskId2}`);
    console.log(`  结果数量: ${task2.task_results.length}期`);

    console.log(`\n  前15期数据:`);
    task2.task_results.slice(0, 15).forEach(r => {
      const redCount = r.retained_combinations?.red_combinations?.length || 0;
      const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
      const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
      const isPredicted = r.is_predicted ? '推算' : '已开奖';

      console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
    });
  }

  await mongoose.connection.close();
}).catch(console.error);
