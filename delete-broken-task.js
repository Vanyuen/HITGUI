/**
 * 删除有问题的任务
 */

const mongoose = require('mongoose');

const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    status: String
});

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number
});

const HwcPositivePredictionTask = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTask',
    hwcPositivePredictionTaskSchema,
    'hit_dlt_hwcpositivepredictiontasks'
);

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function deleteTask() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('='.repeat(80));
        console.log('删除有问题的任务');
        console.log('='.repeat(80));

        // 查找最新任务
        const latestTask = await HwcPositivePredictionTask.findOne({}).sort({ created_at: -1 }).lean();

        if (!latestTask) {
            console.log('\n❌ 没有找到任何任务');
            mongoose.connection.close();
            return;
        }

        const taskId = latestTask.task_id;
        const taskName = latestTask.task_name;
        const status = latestTask.status;

        console.log(`\n📋 找到任务:`);
        console.log(`   - ID: ${taskId}`);
        console.log(`   - 名称: ${taskName}`);
        console.log(`   - 状态: ${status}`);

        // 查询该任务的结果数量
        const resultCount = await HwcPositivePredictionTaskResult.countDocuments({ task_id: taskId });
        console.log(`   - 结果数量: ${resultCount}期`);

        console.log('\n🗑️  开始删除...');

        // 删除任务结果
        const deleteResults = await HwcPositivePredictionTaskResult.deleteMany({ task_id: taskId });
        console.log(`   ✅ 删除任务结果: ${deleteResults.deletedCount}条`);

        // 删除任务本身
        const deleteTask = await HwcPositivePredictionTask.deleteOne({ task_id: taskId });
        console.log(`   ✅ 删除任务记录: ${deleteTask.deletedCount}条`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ 删除完成!');
        console.log('='.repeat(80));
        console.log('\n💡 提示: 现在可以重新创建任务了,新任务将会正确计算命中分析。');
        console.log('='.repeat(80));

        mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

deleteTask();
