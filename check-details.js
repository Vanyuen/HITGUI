const mongoose = require('mongoose');

async function checkDetails() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 统计该任务所有期号的详情
    const byPeriod = await db.collection('hit_dlt_exclusiondetails').aggregate([
        { $match: { task_id: 'hwc-pos-20251202-ge3' } },
        { $group: {
            _id: '$period',
            count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
    ]).toArray();

    console.log('=== 按期号统计排除详情 ===');
    console.log('总期号数:', byPeriod.length);
    byPeriod.forEach(p => console.log('  期号:', p._id, '| 记录数:', p.count));

    // 检查任务的issue_range
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251202-ge3' });

    console.log('\n=== 任务期号范围 ===');
    console.log('issue_range长度:', task?.issue_range?.length);
    if (task?.issue_range?.length > 0) {
        console.log('第一期:', task.issue_range[0]);
        console.log('最后一期:', task.issue_range[task.issue_range.length - 1]);
    }

    // 检查结果记录数
    const resultsCount = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .countDocuments({ task_id: 'hwc-pos-20251202-ge3' });
    console.log('结果记录数:', resultsCount);

    // 检查哪些期号有 has_exclusion_details = true
    const withDetails = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .countDocuments({ task_id: 'hwc-pos-20251202-ge3', has_exclusion_details: true });
    console.log('has_exclusion_details=true的结果数:', withDetails);

    await mongoose.disconnect();
}

checkDetails().catch(e => console.error(e));
