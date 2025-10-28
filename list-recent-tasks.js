const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

const PredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    created_at: Date,
    exclusion_conditions: Object
}, { collection: 'PredictionTask' });

const PredictionTask = mongoose.model('PredictionTask', PredictionTaskSchema);

async function listRecentTasks() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB连接成功\n');

        const tasks = await PredictionTask.find()
            .sort({ created_at: -1 })
            .limit(10)
            .lean();

        console.log(`📋 最近10个任务:\n`);
        for (const task of tasks) {
            console.log(`任务ID: ${task.task_id}`);
            console.log(`创建时间: ${task.created_at}`);
            console.log('---');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

listRecentTasks();
