const { MongoClient } = require('mongodb');

async function listHwcTasks() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');

    try {
        await client.connect();
        const db = client.db('lottery');

        console.log('\n========== 所有预测任务列表 ==========\n');

        // 查询最近的任务
        const tasks = await db.collection('PredictionTask')
            .find({})
            .sort({ created_at: -1 })
            .limit(20)
            .toArray();

        console.log(`共找到 ${tasks.length} 个任务（最近20个）:\n`);

        for (const task of tasks) {
            console.log(`任务ID: ${task.task_id}`);
            console.log(`  任务名称: ${task.task_name}`);
            console.log(`  预测模式: ${task.prediction_mode}`);
            console.log(`  状态: ${task.status}`);
            console.log(`  创建时间: ${task.created_at}`);

            if (task.prediction_mode === 'hwc_positive') {
                console.log(`  🌡️ 热温冷正选任务`);
                if (task.exclusion_conditions?.hwc_positive_conditions) {
                    const hwc = task.exclusion_conditions.hwc_positive_conditions;
                    console.log(`     热温冷比: ${JSON.stringify(hwc.hwc_ratio)}`);
                    console.log(`     区间比: ${JSON.stringify(hwc.zone_ratio)}`);
                    console.log(`     奇偶比: ${JSON.stringify(hwc.odd_even_ratio)}`);
                }
            }

            console.log('');
        }

        // 查找与用户报告的任务最相似的任务
        console.log('\n========== 查找热温冷正选任务 ==========\n');

        const hwcTasks = await db.collection('PredictionTask')
            .find({ prediction_mode: 'hwc_positive' })
            .sort({ created_at: -1 })
            .limit(10)
            .toArray();

        console.log(`找到 ${hwcTasks.length} 个热温冷正选任务:\n`);

        for (const task of hwcTasks) {
            console.log(`任务ID: ${task.task_id}`);
            console.log(`  状态: ${task.status}`);
            console.log(`  创建时间: ${task.created_at}`);

            // 检查这个任务是否有结果
            const resultCount = await db.collection('PredictionTaskResult')
                .countDocuments({ task_id: task.task_id });

            console.log(`  结果记录数: ${resultCount}`);
            console.log('');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await client.close();
    }
}

listHwcTasks();
