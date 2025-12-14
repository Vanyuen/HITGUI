const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('=== 两个任务的完整配置对比 ===\n');

    // 获取两个任务的完整配置
    const gflTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251203-gfl' });

    const lmzTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251203-lmz' });

    console.log('=== gfl任务 ===');
    const gflKeys = Object.keys(gflTask || {}).filter(k => k !== '_id');
    for (const key of gflKeys) {
        const val = gflTask[key];
        if (typeof val === 'object') {
            console.log(key + ':', JSON.stringify(val));
        } else {
            console.log(key + ':', val);
        }
    }

    console.log('\n=== lmz任务 ===');
    const lmzKeys = Object.keys(lmzTask || {}).filter(k => k !== '_id');
    for (const key of lmzKeys) {
        const val = lmzTask[key];
        if (typeof val === 'object') {
            console.log(key + ':', JSON.stringify(val));
        } else {
            console.log(key + ':', val);
        }
    }

    // 特别检查筛选条件
    console.log('\n=== 筛选条件详细对比 ===');
    console.log('gfl filter_conditions:', gflTask?.filter_conditions);
    console.log('lmz filter_conditions:', lmzTask?.filter_conditions);

    console.log('gfl hwc_positive_ratios:', gflTask?.hwc_positive_ratios);
    console.log('lmz hwc_positive_ratios:', lmzTask?.hwc_positive_ratios);

    await mongoose.disconnect();
}

check().catch(e => console.error(e));
