const mongoose = require('mongoose');

async function checkOldTasks() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ MongoDB连接成功\n');

        const db = mongoose.connection.db;

        // 检查所有可能的任务集合
        const possibleCollections = [
            'PredictionTask',
            'predictiontasks',
            'hit_prediction_tasks',
            'hit_dlt_predictiontasks',
            'HIT_DLT_PredictionTasks'
        ];

        console.log('🔍 检查所有可能的任务集合:\n');

        for (const collName of possibleCollections) {
            try {
                const count = await db.collection(collName).countDocuments();
                console.log(`📊 ${collName}: ${count} 条记录`);

                if (count > 0) {
                    console.log(`   ⭐ 发现任务数据！`);
                    const tasks = await db.collection(collName).find().limit(5).toArray();
                    tasks.forEach((task, idx) => {
                        console.log(`   ${idx + 1}. task_id: ${task.task_id}, created_at: ${task.created_at}`);
                    });
                    console.log('');
                }
            } catch (err) {
                console.log(`   ⚠️  ${collName} 不存在或无法访问`);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ 检查完成');
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkOldTasks();
