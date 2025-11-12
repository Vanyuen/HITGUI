const mongoose = require('mongoose');

async function checkTasks() {
    try {
        console.log('🔍 检查任务状态...\n');

        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const PredictionTask = mongoose.model('PredictionTask', new mongoose.Schema({}, { strict: false }));

        // 检查所有任务（不限状态）
        const allTasks = await PredictionTask.find({}).sort({ created_at: -1 }).lean();

        console.log(`📊 总任务数: ${allTasks.length}\n`);

        if (allTasks.length > 0) {
            console.log('所有任务列表:\n');
            allTasks.forEach((task, idx) => {
                console.log(`--- 任务 ${idx + 1} ---`);
                console.log(`  ID: ${task._id}`);
                console.log(`  名称: ${task.task_name || 'N/A'}`);
                console.log(`  状态: ${task.status}`);
                console.log(`  基准期: ${task.base_issue || 'N/A'}`);
                console.log(`  期号数: ${task.target_issues ? task.target_issues.length : 0}`);
                console.log(`  创建时间: ${task.created_at}`);
                console.log(`  更新时间: ${task.updated_at || 'N/A'}`);
                console.log('');
            });

            // 检查processing状态的任务
            const processingTasks = allTasks.filter(t => t.status === 'processing');
            console.log(`⚙️ 正在处理的任务: ${processingTasks.length}个`);

            const failedTasks = allTasks.filter(t => t.status === 'failed');
            console.log(`❌ 失败的任务: ${failedTasks.length}个`);

            const completedTasks = allTasks.filter(t => t.status === 'completed');
            console.log(`✅ 完成的任务: ${completedTasks.length}个`);

            const pendingTasks = allTasks.filter(t => t.status === 'pending');
            console.log(`⏳ 等待中的任务: ${pendingTasks.length}个\n`);
        }

        // 检查结果表
        const PredictionTaskResult = mongoose.model('PredictionTaskResult', new mongoose.Schema({}, { strict: false }));
        const resultCount = await PredictionTaskResult.countDocuments();
        console.log(`📊 PredictionTaskResult 总记录数: ${resultCount}\n`);

        await mongoose.disconnect();
        console.log('✅ 检查完成');

    } catch (error) {
        console.error('❌ 检查出错:', error);
    }
}

checkTasks();
