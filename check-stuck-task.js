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

    const taskId = 'task_1761564137120_qdsiwi0ja';

    // 查询任务详情
    const task = await PredictionTask.findOne({ task_id: taskId });
    console.log('📋 任务详情:');
    console.log(`  任务名称: ${task.task_name}`);
    console.log(`  状态: ${task.status}`);
    console.log(`  进度: ${task.progress.current}/${task.progress.total} (${task.progress.percentage}%)`);
    console.log(`  创建时间: ${task.created_at}`);
    console.log(`  更新时间: ${task.updated_at}`);
    console.log(`  统计数据:`, task.statistics);
    console.log('');

    // 查询任务结果数量
    const resultCount = await PredictionTaskResult.countDocuments({ task_id: taskId });
    console.log(`🔢 任务结果数量: ${resultCount}`);

    if (resultCount > 0) {
      const sampleResult = await PredictionTaskResult.findOne({ task_id: taskId });
      console.log('📝 结果样本:', JSON.stringify(sampleResult, null, 2));
    } else {
      console.log('❌ 没有找到任何任务结果！');
      console.log('\n🔧 建议操作:');
      console.log('  1. 删除该僵尸任务');
      console.log('  2. 重新创建任务并执行');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStuckTask();
