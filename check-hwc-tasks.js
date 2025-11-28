/**
 * 检查热温冷正选批量预测任务数据
 */

const mongoose = require('mongoose');

async function checkHwcTasks() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n=== 检查热温冷正选批量预测任务数据 ===\n');

        const db = mongoose.connection.db;

        // 1. 检查所有collection名称（查找hwc相关）
        const collections = await db.listCollections().toArray();
        const hwcCollections = collections.filter(c =>
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('hotwarmcold') ||
            c.name.toLowerCase().includes('positive')
        );

        console.log('1. HWC相关集合:');
        if (hwcCollections.length === 0) {
            console.log('   ❌ 未找到任何HWC相关集合\n');
        } else {
            for (const coll of hwcCollections) {
                const count = await db.collection(coll.name).countDocuments({});
                console.log(`   - ${coll.name}: ${count} 条记录`);
            }
        }

        // 2. 检查所有可能的任务集合
        const taskCollectionNames = [
            'predictiontasks',
            'hwcpositivepredictiontasks',
            'hwc_positive_prediction_tasks',
            'hit_hwc_positive_prediction_tasks'
        ];

        console.log('\n2. 检查可能的任务集合:');
        for (const collName of taskCollectionNames) {
            try {
                const count = await db.collection(collName).countDocuments({});
                if (count > 0) {
                    console.log(`   ✅ ${collName}: ${count} 条记录`);
                    const latest = await db.collection(collName).findOne({}, { sort: { created_at: -1 } });
                    console.log(`      最新任务ID: ${latest.task_id || latest._id}`);
                    console.log(`      状态: ${latest.status}`);
                    console.log(`      创建时间: ${latest.created_at}`);
                } else {
                    console.log(`   ⚪ ${collName}: 0 条记录`);
                }
            } catch (err) {
                console.log(`   ❌ ${collName}: 集合不存在`);
            }
        }

        // 3. 检查所有可能的任务结果集合
        const resultCollectionNames = [
            'predictiontaskresults',
            'hwcpositivepredictiontaskresults',
            'hwc_positive_prediction_task_results',
            'hit_hwc_positive_prediction_task_results'
        ];

        console.log('\n3. 检查可能的任务结果集合:');
        for (const collName of resultCollectionNames) {
            try {
                const count = await db.collection(collName).countDocuments({});
                if (count > 0) {
                    console.log(`   ✅ ${collName}: ${count} 条记录`);
                } else {
                    console.log(`   ⚪ ${collName}: 0 条记录`);
                }
            } catch (err) {
                console.log(`   ❌ ${collName}: 集合不存在`);
            }
        }

        console.log('\n=== 检查完成 ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

checkHwcTasks();
