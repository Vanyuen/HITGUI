const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 查找所有集合，看看结果存储在哪里...\n');

  const collections = await db.listCollections().toArray();
  const taskResultCollections = collections.filter(c =>
    c.name.includes('hwc-pos-20251121') || c.name.includes('taskresult')
  );

  console.log('相关集合:');
  taskResultCollections.forEach(c => {
    console.log(`  - ${c.name}`);
  });

  console.log('\n🔍 检查最新任务的 statistics 字段...\n');

  const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
    .findOne({ task_id: 'hwc-pos-20251121-b6s' });

  if (task) {
    console.log('📊 statistics 字段:');
    console.log(JSON.stringify(task.statistics, null, 2));

    console.log('\n📊 issue_pairs 字段 (前10个):');
    if (task.issue_pairs && task.issue_pairs.length > 0) {
      console.log(`  总数: ${task.issue_pairs.length}`);
      task.issue_pairs.slice(0, 10).forEach(pair => {
        console.log(`  ${pair.base} → ${pair.target}`);
      });
    }
  }

  // 检查是否有 PredictionTaskResult 集合
  console.log('\n🔍 检查 PredictionTaskResult 集合...\n');

  const hasTaskResultCollection = collections.some(c =>
    c.name.toLowerCase().includes('predictiontaskresult')
  );

  if (hasTaskResultCollection) {
    console.log('✅ 找到 PredictionTaskResult 集合');

    const results = await db.collection('predictiontaskresults')
      .find({ task_id: 'hwc-pos-20251121-b6s' })
      .sort({ period: 1 })
      .limit(15)
      .toArray();

    console.log(`  结果数量: ${results.length}`);

    if (results.length > 0) {
      console.log(`\n  前15期数据:`);
      results.forEach(r => {
        const redCount = r.retained_combinations?.red_combinations?.length || 0;
        const blueCount = r.retained_combinations?.blue_combinations?.length || 0;
        const pairedCount = r.retained_combinations?.paired_combinations?.length || 0;
        const isPredicted = r.is_predicted ? '推算' : '已开奖';

        console.log(`    ${r.period} (${isPredicted}): 红=${redCount}, 蓝=${blueCount}, 配对=${pairedCount}`);
      });
    }
  } else {
    console.log('❌ 未找到 PredictionTaskResult 集合');
  }

  await mongoose.connection.close();
}).catch(console.error);
