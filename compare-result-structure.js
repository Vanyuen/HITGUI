const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 对比两个任务的结果数据结构
    console.log('=== lmz任务结果数据结构 ===');
    const lmzResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251203-lmz', is_predicted: false });
    console.log('字段列表:', Object.keys(lmzResult || {}));
    console.log('hit_analysis:', JSON.stringify(lmzResult?.hit_analysis, null, 2));
    console.log('exclusion_summary:', JSON.stringify(lmzResult?.exclusion_summary, null, 2));
    console.log('exclusions_to_save 类型:', lmzResult?.exclusions_to_save ? typeof lmzResult.exclusions_to_save : 'undefined');

    console.log('\n=== gfl任务结果数据结构 ===');
    const gflResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251203-gfl', is_predicted: false });
    console.log('字段列表:', Object.keys(gflResult || {}));
    console.log('hit_analysis:', JSON.stringify(gflResult?.hit_analysis, null, 2));
    console.log('exclusion_summary:', JSON.stringify(gflResult?.exclusion_summary, null, 2));
    console.log('exclusions_to_save 类型:', gflResult?.exclusions_to_save ? typeof gflResult.exclusions_to_save : 'undefined');

    // 检查gfl任务结果的完整结构
    console.log('\n=== gfl任务一条完整结果 ===');
    const gflFullResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251203-gfl', period: '25124' });
    console.log(JSON.stringify(gflFullResult, null, 2));

    await mongoose.disconnect();
}

analyze().catch(e => console.error(e));
