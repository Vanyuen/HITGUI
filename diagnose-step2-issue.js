const mongoose = require('mongoose');

async function deepDiagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('===================================');
    console.log('深度诊断：Step2排除详情缺失问题');
    console.log('===================================');

    // 1. 获取所有hwc-pos-20251209-开头的任务
    const tasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: /^hwc-pos-20251209-/ })
        .sort({ created_at: 1 })
        .toArray();

    console.log('\n=== 所有任务排除详情存储统计 ===');
    console.log('任务ID'.padEnd(30) + ' | Step2记录数 | 其他Step记录数');
    console.log('-'.repeat(60));

    for (const task of tasks) {
        // 查询Step2记录数
        const step2Count = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        // 查询其他Step记录数
        const otherStepCount = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: { $ne: 2 } });

        const step2Status = step2Count > 0 ? '✅' : '❌';
        console.log(task.task_id.padEnd(30) + ' | ' + step2Status + ' ' + String(step2Count).padStart(5) + '  | ' + otherStepCount);
    }

    // 2. 检查tka和第一个无Step2任务的差异
    console.log('\n=== tka 排除详情各Step分布 ===');
    const tkaDetails = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .aggregate([
            { $match: { task_id: 'hwc-pos-20251209-tka' } },
            { $group: { _id: '$step', count: { $sum: 1 }, total_excluded: { $sum: '$excluded_count' } } },
            { $sort: { _id: 1 } }
        ]).toArray();
    tkaDetails.forEach(d => console.log('  Step', d._id, ':', d.count, '条记录, 共排除', d.total_excluded, '个组合'));

    console.log('\n=== vw8 排除详情各Step分布 ===');
    const vw8Details = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .aggregate([
            { $match: { task_id: 'hwc-pos-20251209-vw8' } },
            { $group: { _id: '$step', count: { $sum: 1 }, total_excluded: { $sum: '$excluded_count' } } },
            { $sort: { _id: 1 } }
        ]).toArray();
    vw8Details.forEach(d => console.log('  Step', d._id, ':', d.count, '条记录, 共排除', d.total_excluded, '个组合'));

    // 3. 检查两个任务的positive_selection配置差异
    const tka = tasks.find(t => t.task_id === 'hwc-pos-20251209-tka');
    const vw8 = tasks.find(t => t.task_id === 'hwc-pos-20251209-vw8');

    console.log('\n=== 正选条件配置差异 ===');
    console.log('tka zone_ratios:', JSON.stringify(tka.positive_selection?.zone_ratios?.slice(0, 3)), '... 共', tka.positive_selection?.zone_ratios?.length);
    console.log('vw8 zone_ratios:', JSON.stringify(vw8.positive_selection?.zone_ratios?.slice(0, 3)), '... 共', vw8.positive_selection?.zone_ratios?.length);

    // 4. 检查 tka 排除详情的创建时间范围
    const tkaFirstDetail = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .findOne({ task_id: 'hwc-pos-20251209-tka' }, { sort: { created_at: 1 } });
    const tkaLastDetail = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .findOne({ task_id: 'hwc-pos-20251209-tka' }, { sort: { created_at: -1 } });

    console.log('\n=== tka 排除详情创建时间 ===');
    console.log('首条:', tkaFirstDetail?.created_at);
    console.log('末条:', tkaLastDetail?.created_at);
    console.log('任务创建:', tka.created_at);

    const vw8FirstDetail = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .findOne({ task_id: 'hwc-pos-20251209-vw8' }, { sort: { created_at: 1 } });
    const vw8LastDetail = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .findOne({ task_id: 'hwc-pos-20251209-vw8' }, { sort: { created_at: -1 } });

    console.log('\n=== vw8 排除详情创建时间 ===');
    console.log('首条:', vw8FirstDetail?.created_at);
    console.log('末条:', vw8LastDetail?.created_at);
    console.log('任务创建:', vw8.created_at);

    await mongoose.disconnect();
}

deepDiagnose().catch(console.error);
