const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 获取最新任务
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    console.log('任务ID:', task.task_id);

    // 获取该任务的所有结果
    const allResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .toArray();

    console.log('该任务结果总数:', allResults.length);

    // 按红球组合数统计
    const statsMap = {};
    allResults.forEach(r => {
        const count = r.red_combinations?.length || 0;
        if (!statsMap[count]) statsMap[count] = 0;
        statsMap[count]++;
    });

    console.log('\n红球组合数分布:');
    Object.entries(statsMap).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).forEach(([count, num]) => {
        console.log('  组合数=' + count + ': ' + num + '个期号');
    });

    // 显示有组合的具体期号
    const withCombos = allResults.filter(r => r.red_combinations?.length > 0);
    console.log('\n有组合的期号详情:');
    withCombos.forEach(r => {
        console.log('  期号', r.period, ':', r.red_combinations.length, '个组合');
        const details = JSON.stringify(r.positive_selection_details);
        console.log('    positive_selection_details:', details.length > 150 ? details.substring(0, 150) + '...' : details);
    });

    // 显示无组合的期号样例
    const withoutCombos = allResults.filter(r => !r.red_combinations?.length);
    console.log('\n无组合期号样例 (前3个):');
    withoutCombos.slice(0, 3).forEach(r => {
        console.log('  期号', r.period);
        console.log('    positive_selection_details:', JSON.stringify(r.positive_selection_details));
    });

    // 检查是否有多个任务的结果
    const allTaskIds = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .distinct('task_id');
    console.log('\n所有任务ID:', allTaskIds.length, '个');

    await mongoose.disconnect();
}

check().catch(console.error);
