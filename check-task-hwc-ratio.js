const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  const taskId = 'hwc-pos-20251120-y1n';

  console.log(`\n🔍 检查任务 ${taskId} 的热温冷比数据...\n`);

  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({ task_id: taskId });

  if (!task) {
    console.log('❌ 未找到任务');
    await mongoose.connection.close();
    return;
  }

  console.log('📋 任务基本信息:');
  console.log(`  任务ID: ${task.task_id}`);
  console.log(`  任务名称: ${task.task_name}`);
  console.log(`  状态: ${task.status}`);
  console.log(`\n✨ 正选条件 (positive_selection):`);
  console.log(JSON.stringify(task.positive_selection, null, 2));

  console.log(`\n🔍 详细检查 red_hot_warm_cold_ratios 字段:`);
  if (task.positive_selection && task.positive_selection.red_hot_warm_cold_ratios) {
    const ratios = task.positive_selection.red_hot_warm_cold_ratios;
    console.log(`  类型: ${typeof ratios}`);
    console.log(`  是否为数组: ${Array.isArray(ratios)}`);
    console.log(`  长度: ${ratios.length}`);
    console.log(`  内容: ${JSON.stringify(ratios)}`);
  } else {
    console.log('  ❌ 字段不存在或为空');
  }

  await mongoose.connection.close();
}).catch(console.error);
