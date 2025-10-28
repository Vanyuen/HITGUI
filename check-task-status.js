const mongoose = require('mongoose');

// 连接MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const PredictionTask = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false, collection: 'PredictionTask' }));

async function checkTasks() {
    try {
        console.log('📊 查询最近的预测任务...\n');

        const tasks = await PredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        console.log(`找到 ${tasks.length} 个任务:\n`);

        tasks.forEach((task, index) => {
            console.log(`${index + 1}. 任务ID: ${task.task_id}`);
            console.log(`   任务名称: ${task.task_name || '未命名'}`);
            console.log(`   状态: ${task.status}`);
            console.log(`   期号范围: ${task.base_issue}-${task.target_issue}`);
            console.log(`   创建时间: ${task.created_at}`);
            console.log(`   更新时间: ${task.updated_at}`);
            if (task.error_message) {
                console.log(`   ❌ 错误信息: ${task.error_message}`);
            }
            console.log('');
        });

    } catch (error) {
        console.error('❌ 查询失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

checkTasks();
