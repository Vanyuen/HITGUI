/**
 * 搜索所有热温冷正选批量预测任务
 */

const mongoose = require('mongoose');

async function findAllHwcPosTasks() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ 已连接到 MongoDB');

    const PredictionTask = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' }));

    // 查找所有包含 "hwc" 或 "热温冷" 的任务
    const tasks = await PredictionTask.find({
      $or: [
        { task_id: /hwc/i },
        { task_name: /热温冷/i }
      ]
    }).sort({ created_at: -1 }).limit(20).lean();

    console.log(`\n找到 ${tasks.length} 个相关任务:\n`);

    tasks.forEach((task, index) => {
      console.log(`任务 #${index + 1}:`);
      console.log('  task_id:', task.task_id);
      console.log('  task_name:', task.task_name);
      console.log('  status:', task.status);
      console.log('  created_at:', task.created_at);
      console.log('  range_type:', task.range_type);
      console.log('  recent_count:', task.recent_count);
      console.log('  issues count:', task.issues?.length || 0);
      console.log('  predicted_issue:', task.predicted_issue);
      console.log('---');
    });

    // 查找最近创建的任务
    console.log('\n========================================');
    console.log('📋 最近创建的所有任务 (最新10个)');
    console.log('========================================');

    const recentTasks = await PredictionTask.find({})
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    recentTasks.forEach((task, index) => {
      console.log(`\n任务 #${index + 1}:`);
      console.log('  task_id:', task.task_id);
      console.log('  task_name:', task.task_name);
      console.log('  status:', task.status);
      console.log('  created_at:', task.created_at);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await mongoose.disconnect();
  }
}

findAllHwcPosTasks();
