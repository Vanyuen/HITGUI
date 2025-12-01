const mongoose = require('mongoose');

async function compareSamePeriods() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 对比相同期号在两个任务中的结果 ===\n');

    // 问题任务
    const badTaskId = 'hwc-pos-20251129-xge';
    // 正常任务
    const goodTaskId = 'hwc-pos-20251129-2ia';

    // 两个任务都包含的期号范围: 25095-25125
    const commonPeriods = ['25095', '25100', '25110', '25120', '25124', '25125'];

    console.log('对比期号:', commonPeriods.join(', '));

    for (const period of commonPeriods) {
        console.log(`\n=== 期号 ${period} ===`);

        const badResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: badTaskId, period: period });

        const goodResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: goodTaskId, period: period });

        console.log('问题任务 (xge):');
        if (badResult) {
            console.log('  combos:', badResult.red_combinations?.length);
            console.log('  step1_count:', badResult.positive_selection_details?.step1_count);
        } else {
            console.log('  未包含');
        }

        console.log('正常任务 (2ia):');
        if (goodResult) {
            console.log('  combos:', goodResult.red_combinations?.length);
            console.log('  step1_count:', goodResult.positive_selection_details?.step1_count);
        } else {
            console.log('  未包含');
        }
    }

    // 关键: 检查任务2ia中25095的结果
    console.log('\n=== 关键检查: 正常任务中25095-25100的结果 ===');
    const goodResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({
            task_id: goodTaskId,
            period: { $in: ['25095', '25096', '25097', '25098', '25099', '25100'] }
        })
        .toArray();

    for (const r of goodResults) {
        console.log(`${r.period}: combos=${r.red_combinations?.length}, step1=${r.positive_selection_details?.step1_count}`);
    }

    // 检查任务创建时间顺序
    console.log('\n=== 任务创建时间顺序 ===');
    const tasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: { $in: [badTaskId, goodTaskId] } })
        .sort({ created_at: 1 })
        .toArray();

    for (const t of tasks) {
        console.log(`${t.task_id}: ${t.created_at} - ${t.status}`);
    }

    await mongoose.disconnect();
}

compareSamePeriods().catch(console.error);
