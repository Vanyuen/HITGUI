const mongoose = require('mongoose');

async function checkTasks() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 查看最近的任务
    const tasks = await db.collection('hwcpositivepredictiontasks').find({}).sort({created_at: -1}).limit(3).toArray();
    console.log('=== 最近3个热温冷正选任务 ===\n');

    for (const t of tasks) {
      console.log('task_id:', t.task_id);
      console.log('status:', t.status);
      console.log('progress:', JSON.stringify(t.progress));
      console.log('statistics:', JSON.stringify(t.statistics, null, 2));

      // 查看对应的结果数量
      const count = await db.collection('hwcpositivepredictiontaskresults').countDocuments({task_id: t.task_id});
      console.log('结果数量:', count);

      // 如果有结果，查看第一条的hit_analysis
      if (count > 0) {
        const result = await db.collection('hwcpositivepredictiontaskresults').findOne({task_id: t.task_id});
        console.log('第一条结果的hit_analysis:', JSON.stringify(result.hit_analysis, null, 2));
      }
      console.log('---\n');
    }

    process.exit(0);
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
}

checkTasks();
