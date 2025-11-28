/**
 * 检查任务的 statistics 字段
 */

const mongoose = require('mongoose');

async function checkTaskStatistics() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n=== 检查任务 statistics 字段 ===\n');

        const db = mongoose.connection.db;

        // 查询最新的任务
        const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne(
            {},
            { sort: { created_at: -1 } }
        );

        if (!latestTask) {
            console.log('❌ 没有找到任务');
            mongoose.connection.close();
            return;
        }

        console.log('最新任务信息:');
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  任务名称: ${latestTask.task_name}`);
        console.log(`  状态: ${latestTask.status}`);
        console.log(`  创建时间: ${latestTask.created_at}`);
        console.log(`  完成时间: ${latestTask.completed_at || '未完成'}`);

        console.log('\nstatistics 字段:');
        if (latestTask.statistics) {
            console.log(JSON.stringify(latestTask.statistics, null, 2));
        } else {
            console.log('  ❌ statistics 字段不存在或为空');
        }

        console.log('\nprogress 字段:');
        if (latestTask.progress) {
            console.log(JSON.stringify(latestTask.progress, null, 2));
        }

        // 查询该任务的结果数量
        const resultsCount = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').countDocuments({
            task_id: latestTask.task_id
        });

        console.log(`\n该任务的结果记录数: ${resultsCount}`);

        if (resultsCount > 0) {
            // 查询一个示例结果
            const sampleResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne({
                task_id: latestTask.task_id
            });

            console.log('\n示例结果记录:');
            console.log(`  期号: ${sampleResult.period}`);
            console.log(`  组合数: ${sampleResult.combination_count}`);
            console.log(`  命中分析: ${sampleResult.hit_analysis ? 'Yes' : 'No'}`);

            if (sampleResult.hit_analysis) {
                console.log('\n命中分析详情:');
                console.log(JSON.stringify(sampleResult.hit_analysis, null, 2));
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

checkTaskStatistics();
