const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 对比两个任务
    const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: { $in: ['hwc-pos-20251203-lmz', 'hwc-pos-20251203-gfl'] } })
        .toArray();

    for (const task of tasks) {
        console.log('\n========================================');
        console.log('任务:', task.task_id);
        console.log('========================================');
        console.log('期号范围:', task.period_range?.start_issue, '-', task.period_range?.end_issue);
        console.log('期数:', task.period_range?.total_periods);
        console.log('exclusion_details配置:', JSON.stringify(task.output_config?.exclusion_details, null, 2));
        console.log('exclusion_details_status:', task.exclusion_details_status);
        console.log('exclusion_details_periods:', task.exclusion_details_periods);
        console.log('exclusion_details_progress:', JSON.stringify(task.exclusion_details_progress, null, 2));

        // 查询该任务的排除详情记录数
        const detailsCount = await db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id });
        console.log('排除详情记录数:', detailsCount);

        // 按期号分组
        const byPeriod = await db.collection('hit_dlt_exclusiondetails')
            .aggregate([
                { $match: { task_id: task.task_id } },
                { $group: { _id: '$period', count: { $sum: 1 } } },
                { $sort: { _id: -1 } }
            ]).toArray();
        console.log('各期记录:', byPeriod.map(p => p._id + ':' + p.count).join(', ') || '无');

        // 检查结果表中有多少期标记为has_exclusion_details
        const resultsWithDetails = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .countDocuments({ task_id: task.task_id, has_exclusion_details: true });
        console.log('has_exclusion_details=true的结果数:', resultsWithDetails);
    }

    await mongoose.disconnect();
}

analyze().catch(e => console.error(e));
