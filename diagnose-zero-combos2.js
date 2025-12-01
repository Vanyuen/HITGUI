const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 获取最新任务的所有结果，按期号排序
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .sort({ period: 1 })
        .toArray();

    console.log('=== 任务:', task.task_id, '===');
    console.log('结果总数:', results.length);

    // 统计有组合和无组合的期号
    const withCombos = results.filter(r => r.red_combinations && r.red_combinations.length > 0);
    const withoutCombos = results.filter(r => !r.red_combinations || r.red_combinations.length === 0);

    console.log('\n有组合的期号数:', withCombos.length);
    console.log('无组合的期号数:', withoutCombos.length);

    if (withCombos.length > 0) {
        console.log('\n有组合的期号:');
        withCombos.forEach(r => {
            console.log('  期号', r.period, ':', r.red_combinations?.length || 0, '个组合, is_predicted=' + r.is_predicted);
        });
    }

    if (withoutCombos.length > 0) {
        console.log('\n无组合期号样例 (前10个):');
        withoutCombos.slice(0, 10).forEach(r => {
            console.log('  期号', r.period, ': is_predicted=' + r.is_predicted);
        });
    }

    // 对比有组合和无组合期号的positive_selection_details
    console.log('\n=== positive_selection_details 对比 ===');
    if (withCombos.length > 0) {
        console.log('有组合期号示例:', JSON.stringify(withCombos[0].positive_selection_details));
    }
    if (withoutCombos.length > 0) {
        console.log('无组合期号示例:', JSON.stringify(withoutCombos[0].positive_selection_details));
    }

    await mongoose.disconnect();
}

check().catch(console.error);
