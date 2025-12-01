const mongoose = require('mongoose');

async function checkSpecificPeriod() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 详细检查特定期号 ===\n');

    // 1. 获取最新任务
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    console.log('任务信息:');
    console.log('  task_id:', task.task_id);
    console.log('  created_at:', task.created_at);
    console.log('  status:', task.status);

    // 2. 检查几个期号的完整数据
    const periodsToCheck = ['25095', '25096', '25124', '25125'];

    for (const period of periodsToCheck) {
        const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: task.task_id, period: period });

        console.log(`\n=== 期号 ${period} ===`);
        if (result) {
            console.log('  is_predicted:', result.is_predicted);
            console.log('  red_combinations.length:', result.red_combinations?.length);
            console.log('  blue_combinations.length:', result.blue_combinations?.length);
            console.log('  combination_count:', result.combination_count);
            console.log('  pairing_mode:', result.pairing_mode);
            console.log('  error:', result.error || '无');
            console.log('  winning_numbers:', JSON.stringify(result.winning_numbers));
            console.log('  hit_analysis 存在?:', !!result.hit_analysis);
            console.log('  exclusion_summary:', JSON.stringify(result.exclusion_summary));
            console.log('  positive_selection_details:', JSON.stringify(result.positive_selection_details));
        } else {
            console.log('  ❌ 未找到结果');
        }
    }

    // 3. 检查是否有多个任务的结果（可能覆盖）
    console.log('\n=== 检查任务ID唯一性 ===');
    const allTaskIds = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .distinct('task_id');
    console.log('所有任务ID:', allTaskIds);

    // 4. 检查每个任务的结果统计
    for (const taskId of allTaskIds) {
        const count = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .countDocuments({ task_id: taskId });

        const withCombos = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .countDocuments({
                task_id: taskId,
                'red_combinations.0': { $exists: true }
            });

        console.log(`\n任务 ${taskId}: 总${count}条, 有组合${withCombos}条`);
    }

    // 5. 检查是否有结果被覆盖（同一期号多条记录）
    console.log('\n=== 检查重复记录 ===');
    const duplicates = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults').aggregate([
        { $group: { _id: { task_id: '$task_id', period: '$period' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]).toArray();

    console.log('重复记录:', duplicates.length > 0 ? duplicates : '无');

    await mongoose.disconnect();
}

checkSpecificPeriod().catch(console.error);
