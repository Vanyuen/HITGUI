const mongoose = require('mongoose');

async function checkTaskDetails() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 检查任务完整结构 ===\n');

    // 获取最新任务
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    console.log('任务完整数据:');
    console.log(JSON.stringify(task, null, 2));

    // 检查关键字段
    console.log('\n=== 关键字段检查 ===');
    console.log('task_id:', task.task_id);
    console.log('positive_selection_filters:', JSON.stringify(task.positive_selection_filters));
    console.log('red_hot_warm_cold_ratios 存在?', !!task.positive_selection_filters?.red_hot_warm_cold_ratios);

    if (task.positive_selection_filters?.red_hot_warm_cold_ratios) {
        console.log('red_hot_warm_cold_ratios:', task.positive_selection_filters.red_hot_warm_cold_ratios);
    }

    // 检查exclusion_conditions
    console.log('\nexclusion_conditions:', JSON.stringify(task.exclusion_conditions));

    // 检查filters (可能是另一个字段名)
    console.log('\nfilters:', JSON.stringify(task.filters));

    // 列出所有字段
    console.log('\n=== 所有字段 ===');
    Object.keys(task).forEach(key => {
        const value = task[key];
        const display = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value;
        console.log(`  ${key}: ${display}`);
    });

    await mongoose.disconnect();
}

checkTaskDetails().catch(console.error);
