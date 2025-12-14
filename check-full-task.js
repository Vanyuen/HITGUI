const mongoose = require('mongoose');

async function checkFullTask() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    
    const tasksCollection = db.collection('hit_dlt_hwcpositivepredictiontasks');
    const task = await tasksCollection.findOne({ task_id: 'hwc-pos-20251212-l15' });
    
    console.log('=== 完整任务记录 ===');
    console.log(JSON.stringify(task, null, 2));
    
    await mongoose.disconnect();
}

checkFullTask().catch(e => { console.error(e); process.exit(1); });
