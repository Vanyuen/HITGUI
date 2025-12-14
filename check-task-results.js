const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 查找最新任务
    const tasks = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');
    const latestTask = await tasks.findOne({}, { sort: { created_at: -1 } });

    if (latestTask) {
        console.log('最新任务:');
        console.log('  ID:', latestTask.task_id);
        console.log('  状态:', latestTask.status);
        console.log('  创建时间:', latestTask.created_at);
        console.log('  期号范围:', latestTask.period_range?.start, '-', latestTask.period_range?.end);

        // 查询该任务的结果
        const results = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const taskResults = await results.find({ task_id: latestTask.task_id }).toArray();

        console.log('\n结果数量:', taskResults.length);

        // 检查每期的组合数
        const nonZero = taskResults.filter(r => r.retained_count > 0);
        const zero = taskResults.filter(r => !r.retained_count || r.retained_count === 0);

        console.log('有数据的期号:', nonZero.length, '期');
        console.log('无数据的期号:', zero.length, '期');

        if (nonZero.length > 0) {
            console.log('\n有数据的期号示例:');
            nonZero.slice(0, 5).forEach(r => {
                console.log('  期号:', r.period, '组合数:', r.retained_count, '是否推算:', r.is_predicted);
            });
        }

        if (zero.length > 0) {
            console.log('\n无数据的期号示例:');
            zero.slice(0, 5).forEach(r => {
                console.log('  期号:', r.period, '组合数:', r.retained_count, '是否推算:', r.is_predicted);
            });
        }
    }

    await mongoose.disconnect();
}

check().catch(e => console.error(e));
