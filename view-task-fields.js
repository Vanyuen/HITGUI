/**
 * 查看原始任务的完整字段
 */
const mongoose = require('mongoose');

async function viewTaskFields() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const taskSchema = new mongoose.Schema({}, { strict: false });
    const Task = mongoose.model('HwcTask2', taskSchema, 'hit_dlt_hwcpositivepredictiontasks');

    const task1 = await Task.findOne({ task_id: 'hwc-pos-20251213-ykt' }).lean();
    console.log('任务1完整字段:');
    console.log(JSON.stringify(task1, null, 2));

    await mongoose.disconnect();
}

viewTaskFields().catch(e => { console.error(e); process.exit(1); });
