/**
 * 删除除最新任务外的所有旧任务
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    created_at: Date
});

const Task = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTask',
    taskSchema,
    'hit_dlt_hwcpositivepredictiontasks'
);

const resultSchema = new mongoose.Schema({
    task_id: String
});

const Result = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    resultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function deleteOldTasks() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('='.repeat(80));
        console.log('删除旧任务');
        console.log('='.repeat(80));

        // 查找所有任务
        const allTasks = await Task.find({}).sort({ created_at: -1 }).lean();
        console.log(`\n找到 ${allTasks.length} 个任务\n`);

        if (allTasks.length <= 1) {
            console.log('只有一个或没有任务,无需删除');
            mongoose.connection.close();
            return;
        }

        // 保留最新的,删除其他的
        const latestTask = allTasks[0];
        const tasksToDelete = allTasks.slice(1);

        console.log(`保留最新任务: ${latestTask.task_id} (${latestTask.task_name})\n`);
        console.log(`准备删除 ${tasksToDelete.length} 个旧任务:\n`);

        let deletedTasksCount = 0;
        let deletedResultsCount = 0;

        for (const task of tasksToDelete) {
            console.log(`删除任务: ${task.task_id} (${task.task_name})`);

            // 删除任务结果
            const resultDel = await Result.deleteMany({ task_id: task.task_id });
            console.log(`  - 删除 ${resultDel.deletedCount} 条结果记录`);
            deletedResultsCount += resultDel.deletedCount;

            // 删除任务本身
            await Task.deleteOne({ task_id: task.task_id });
            deletedTasksCount++;
            console.log('  ✅ 任务已删除\n');
        }

        console.log('='.repeat(80));
        console.log('删除完成');
        console.log('='.repeat(80));
        console.log(`✅ 删除任务: ${deletedTasksCount} 个`);
        console.log(`✅ 删除结果: ${deletedResultsCount} 条`);
        console.log(`✅ 保留任务: ${latestTask.task_id}`);
        console.log('='.repeat(80));

        mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

deleteOldTasks();
