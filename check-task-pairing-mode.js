const mongoose = require('mongoose');

async function checkTaskPairingMode() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const taskColl = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');

        // Find the task
        const task = await taskColl.findOne({
            task_id: 'hwc-pos-20251029-vvz'
        });

        if(task) {
            console.log('📋 任务信息:');
            console.log('  task_id:', task.task_id);
            console.log('  task_name:', task.task_name);
            console.log('  pairing_mode:', task.pairing_mode || 'undefined (应默认为 default)');
            console.log('  status:', task.status);
            console.log('\n🔍 All fields:', Object.keys(task).join(', '));
        } else {
            console.log('❌ 没有找到任务');
        }

        await mongoose.connection.close();
        console.log('\n✅ 检查完成');

    } catch (error) {
        console.error('❌ 检查失败:', error);
        process.exit(1);
    }
}

checkTaskPairingMode();
