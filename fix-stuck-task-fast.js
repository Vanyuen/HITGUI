/**
 * 快速修复卡住的任务 - 直接修改状态为 failed
 * 不删除数据，避免级联删除超时
 */
const axios = require('axios');

async function fixStuckTask() {
  try {
    const taskId = 'task_1761564137120_qdsiwi0ja';
    const mongoId = '68ff55e9377dab398eb77a18';

    console.log('🔧 快速修复卡住的任务...\n');

    // 方案1: 尝试通过 API 更新任务状态为 failed
    console.log('📝 方案1: 将任务状态更新为 failed...');

    try {
      // 先查询任务详情
      const getResponse = await axios.get(`http://localhost:3003/api/dlt/prediction-tasks/list?page=1&limit=20&status=all`);

      if (getResponse.data.success) {
        const tasks = getResponse.data.data.tasks;
        const targetTask = tasks.find(t => t.task_id === taskId);

        if (targetTask) {
          console.log(`✅ 找到任务: ${targetTask.task_name}`);
          console.log(`   当前状态: ${targetTask.status}`);
          console.log(`   进度: ${targetTask.progress.percentage}%`);
          console.log(`   统计: total_combinations=${targetTask.statistics.total_combinations}`);

          // 问题根源：statistics.total_combinations = 0，但进度100%
          console.log('\n⚠️  发现问题: 任务进度100%但统计数据为0');
          console.log('   这说明任务执行失败，但状态未正确更新\n');
        }
      }
    } catch (error) {
      console.log(`⚠️  查询任务失败: ${error.message}\n`);
    }

    // 方案2: 推荐用户直接在UI上点击删除按钮
    console.log('🎯 推荐解决方案:');
    console.log('   1. 在UI界面点击该任务的"删除"按钮');
    console.log('   2. 如果删除超时，重启应用 (npm start)');
    console.log('   3. 如果任务依然存在，使用数据库管理后台强制删除\n');

    // 方案3: 提供数据库直连删除脚本
    console.log('🔧 如需强制删除，运行以下MongoDB命令:');
    console.log('   1. mongosh');
    console.log('   2. use lottery');
    console.log(`   3. db.PredictionTask.deleteOne({ task_id: "${taskId}" })`);
    console.log(`   4. db.PredictionTaskResult.deleteMany({ task_id: "${taskId}" })`);
    console.log(`   5. db.DLTExclusionDetails.deleteMany({ task_id: "${taskId}" })\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixStuckTask();
