const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' });
const resultSchema = new mongoose.Schema({}, { strict: false, collection: 'PredictionTaskResult' });

const PredictionTask = mongoose.model('PredictionTask', taskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult', resultSchema);

async function checkStuckTask() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB\n');
    console.log('=== 诊断最近的任务 ===\n');

    // 查询最近3个热温冷任务
    const tasks = await PredictionTask.find({task_name: /热温冷/}).sort({created_at: -1}).limit(3).lean();

    console.log(`找到 ${tasks.length} 个热温冷任务:\n`);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`${i + 1}. 任务: ${task.task_name || 'N/A'}`);
      console.log(`   任务ID: ${task.task_id || task._id}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   创建时间: ${task.created_at}`);
      console.log(`   更新时间: ${task.updated_at || 'N/A'}`);
      if (task.error_message) {
        console.log(`   错误信息: ${task.error_message}`);
      }
      if (task.progress) {
        console.log(`   进度: ${task.progress.current || 0}/${task.progress.total || 0}`);
      }
      console.log('');
    }

    // 检查最近的任务是否卡住
    if (tasks.length > 0) {
      const latestTask = tasks[0];
      const taskId = latestTask.task_id || latestTask._id;

      console.log(`\n=== 检查最新任务详情 ===`);
      console.log(`任务ID: ${taskId}`);

      // 查询任务结果数量
      const resultCount = await PredictionTaskResult.countDocuments({ task_id: taskId });
      console.log(`任务结果数量: ${resultCount}`);

      if (resultCount === 0 && latestTask.status === 'processing') {
        console.log('\n⚠️ 警告: 任务状态为processing但没有任何结果，可能卡住了！');

        // 检查任务创建时间
        const createdTime = new Date(latestTask.created_at);
        const now = new Date();
        const minutesElapsed = (now - createdTime) / 1000 / 60;
        console.log(`任务已运行: ${minutesElapsed.toFixed(1)} 分钟`);

        if (minutesElapsed > 5) {
          console.log('\n🔧 建议操作:');
          console.log('  1. 检查服务器日志是否有错误');
          console.log('  2. 重启应用重新尝试');
          console.log('  3. 如果问题持续，可能需要调试代码');
        }
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStuckTask();
