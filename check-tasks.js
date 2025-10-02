const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

const predictionTaskSchema = new mongoose.Schema({}, { strict: false, collection: 'prediction_tasks' });
const PredictionTask = mongoose.model('PredictionTask', predictionTaskSchema);

async function checkTasks() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        const tasks = await PredictionTask.find({}, { task_id: 1, task_name: 1, _id: 0 }).limit(20).lean();

        if (tasks.length === 0) {
            console.log('❌ 未找到任何预测任务');
        } else {
            console.log(`📋 找到 ${tasks.length} 个任务:\n`);
            tasks.forEach((task, index) => {
                console.log(`${index + 1}. 任务ID: ${task.task_id || '(无task_id字段)'}`);
                console.log(`   任务名称: ${task.task_name || '(无名称)'}\n`);
            });
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkTasks();
