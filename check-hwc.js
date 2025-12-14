const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 1. 检查热温冷优化表
    const hwcTable = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const hwcCount = await hwcTable.countDocuments();
    console.log('热温冷优化表记录数:', hwcCount);

    if (hwcCount > 0) {
        const sample = await hwcTable.findOne({});
        console.log('\n优化表字段:', Object.keys(sample));
        console.log('示例记录 base_issue:', sample.base_issue);
        console.log('示例记录 target_issue:', sample.target_issue);
        console.log('示例记录 hwc_ratio:', sample.hwc_ratio);
        console.log('示例记录 combination_ids数量:', sample.combination_ids?.length);

        // 检查期号25056的数据
        const for25056 = await hwcTable.findOne({ target_issue: 25056 });
        console.log('\n期号25056的优化数据:', for25056 ? '存在' : '不存在');
        if (for25056) {
            console.log('  base_issue:', for25056.base_issue);
            console.log('  hwc_ratio:', for25056.hwc_ratio);
            console.log('  combination_ids数量:', for25056.combination_ids?.length);
        }
    }

    // 2. 检查任务的热温冷比配置
    const tasks = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');
    const latestTask = await tasks.findOne({ task_id: 'hwc-pos-20251202-0go' });

    console.log('\n任务热温冷比配置:');
    const ratios = latestTask.positive_selection?.red_hot_warm_cold_ratios;
    console.log('选择的热温冷比数量:', ratios?.length);
    if (ratios && ratios.length > 0) {
        console.log('前5个:', ratios.slice(0, 5));
    }

    await mongoose.disconnect();
}

check().catch(e => console.error(e));
