/**
 * 检查最近的任务状态和错误信息
 */

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const taskSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_hwcpositivepredictiontasks' });
const HwcTask = mongoose.model('HwcTask_Check', taskSchema);

async function checkRecentTasks() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 查询最近5个任务
        const recentTasks = await HwcTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        console.log(`📊 最近${recentTasks.length}个任务:\n`);

        if (recentTasks.length === 0) {
            console.log('⚠️  没有找到任何任务记录');
            console.log('提示: 可能是集合名称不正确，或者确实没有创建过任务\n');
        } else {
            recentTasks.forEach((task, index) => {
                console.log(`${index + 1}. 任务ID: ${task.task_id}`);
                console.log(`   任务名称: ${task.task_name || '未命名'}`);
                console.log(`   状态: ${task.status}`);
                console.log(`   创建时间: ${task.created_at}`);
                console.log(`   期号范围: ${task.period_range?.start || '?'} - ${task.period_range?.end || '?'} (${task.period_range?.total || 0}期)`);

                if (task.error_message) {
                    console.log(`   ❌ 错误信息: ${task.error_message}`);
                }

                if (task.status === 'failed') {
                    console.log(`   ⚠️  任务失败`);
                }

                console.log('');
            });
        }

        await mongoose.disconnect();
        console.log('✅ 检查完成');

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        await mongoose.disconnect();
    }
}

checkRecentTasks();
