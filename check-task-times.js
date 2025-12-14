/**
 * 检查任务创建时间和状态
 */
const mongoose = require('mongoose');

async function checkTaskTimes() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const taskSchema = new mongoose.Schema({}, { strict: false });
    const Task = mongoose.model('TaskTime', taskSchema, 'hit_dlt_hwcpositivepredictiontasks');

    const tasks = await Task.find({
        task_id: { $in: ['hwc-pos-20251213-od4', 'hwc-pos-20251213-7ww'] }
    }).lean();

    for (const t of tasks) {
        console.log('Task:', t.task_id);
        console.log('  Created:', t.created_at);
        console.log('  Status:', t.status);
        console.log('  Progress:', t.progress);
        console.log('  Total Periods:', t.total_periods);
        console.log('');
    }

    await mongoose.disconnect();
}

checkTaskTimes().catch(e => { console.error(e); process.exit(1); });
