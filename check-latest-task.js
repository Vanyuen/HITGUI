/**
 * 检查最新任务的字段
 */

const mongoose = require('mongoose');

async function checkLatest() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = mongoose.connection.db;

        console.log('=== 检查最新任务 ===\n');

        const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();

        if (latestTask.length === 0) {
            console.log('未找到任务');
            mongoose.connection.close();
            return;
        }

        const task = latestTask[0];

        console.log('任务ID:', task.task_id);
        console.log('任务名称:', task.task_name);
        console.log('创建时间:', task.created_at);
        console.log('期号范围:', task.period_range?.start, '-', task.period_range?.end);
        console.log('\n正选条件字段:');

        if (task.positive_selection) {
            console.log('  hwc_ratios (旧字段):', task.positive_selection.hwc_ratios !== undefined ? '存在' : '不存在');
            console.log('  red_hot_warm_cold_ratios (新字段):', task.positive_selection.red_hot_warm_cold_ratios !== undefined ? '存在' : '不存在');

            if (task.positive_selection.red_hot_warm_cold_ratios !== undefined) {
                console.log('\n  新字段内容:');
                console.log('   ', JSON.stringify(task.positive_selection.red_hot_warm_cold_ratios, null, 2));
            }

            if (task.positive_selection.hwc_ratios !== undefined) {
                console.log('\n  旧字段内容:');
                console.log('   ', JSON.stringify(task.positive_selection.hwc_ratios, null, 2));
            }
        }

        // 检查结果
        console.log('\n\n=== 检查任务结果 ===\n');
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .sort({ period: 1 })
            .limit(5)
            .toArray();

        console.log(`找到 ${results.length} 条结果记录\n`);

        results.forEach(r => {
            console.log(`期号 ${r.period}:`);
            console.log(`  组合数: ${r.combination_count}`);
            console.log(`  is_predicted: ${r.is_predicted}`);
            console.log(`  has hit_analysis: ${r.hit_analysis && Object.keys(r.hit_analysis).length > 0}`);
        });

        console.log('\n=== 完成 ===');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

checkLatest();
