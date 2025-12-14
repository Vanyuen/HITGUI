const mongoose = require('mongoose');

async function checkTaskTime() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const tasksCollection = db.collection('hit_dlt_hwcpositivepredictiontasks');
    
    // 获取最新几个任务
    console.log('=== 最近3个HWC任务 ===');
    const tasks = await tasksCollection.find({})
        .sort({ created_at: -1 })
        .limit(3)
        .toArray();
    
    for (const t of tasks) {
        console.log('\ntask_id:', t.task_id);
        console.log('  created_at:', t.created_at);
        console.log('  status:', t.status);
    }
    
    console.log('\n=== 时间对比 ===');
    console.log('代码修改时间: 2025-12-11 16:10:18 (本地时间)');
    console.log('               = 2025-12-11 08:10:18 UTC');
    console.log('最新任务时间:', tasks[0]?.created_at);
    
    await mongoose.disconnect();
}

checkTaskTime().catch(e => { console.error(e); process.exit(1); });
