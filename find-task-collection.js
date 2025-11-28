const mongoose = require('mongoose');

console.log('🔍 查找任务集合...\n');

async function findTasks() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 列出所有集合
        const collections = await mongoose.connection.db.listCollections().toArray();

        console.log('📋 所有包含"task"或"hwc"的集合:');
        const taskCollections = collections.filter(c =>
            c.name.toLowerCase().includes('task') ||
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('prediction')
        );

        for (const col of taskCollections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(`  - ${col.name}: ${count}条记录`);
        }

        // 2. 查找最新的任务（尝试多个可能的集合名）
        console.log('\n📋 尝试查找最新任务...');

        const possibleCollections = [
            'hwc_positive_prediction_tasks',
            'predictiontasks',
            'prediction_tasks',
            'HwcPositivePredictionTasks'
        ];

        for (const collName of possibleCollections) {
            try {
                const count = await mongoose.connection.db.collection(collName).countDocuments();
                if (count > 0) {
                    console.log(`\n✅ 找到集合: ${collName} (${count}条记录)`);

                    const latest = await mongoose.connection.db.collection(collName)
                        .find()
                        .sort({ created_at: -1, createdAt: -1, _id: -1 })
                        .limit(1)
                        .toArray();

                    if (latest.length > 0) {
                        console.log('最新任务:');
                        console.log(JSON.stringify(latest[0], null, 2));
                        break;
                    }
                }
            } catch (e) {
                // 集合不存在，继续
            }
        }

        console.log('\n✅ 完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

findTasks();
