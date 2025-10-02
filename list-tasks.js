const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

const predictionTaskSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_predictiontasks' });
const PredictionTask = mongoose.model('PredictionTask', predictionTaskSchema);

async function listTasks() {
    try {
        await mongoose.connect(MONGODB_URI);

        const tasks = await PredictionTask.find({}).lean();

        console.log(`\n找到 ${tasks.length} 个任务:\n`);
        tasks.forEach((task, index) => {
            console.log(`${index + 1}. 任务ID: ${task.task_id}`);
            console.log(`   任务名称: ${task.task_name}`);
            console.log(`   期号范围: ${task.period_range?.start} - ${task.period_range?.end}`);
            console.log(`   状态: ${task.status}`);
            console.log('');
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

listTasks();
