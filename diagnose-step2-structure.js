/**
 * 深入诊断：检查Step2筛选逻辑和排除详情收集
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=============================================');
    console.log('诊断：Step2排除详情数据结构和收集逻辑');
    console.log('=============================================\n');

    // 1. 检查有Step2的任务的排除详情结构
    console.log('=== Step2排除详情结构检查 ===\n');

    const withStep2Tasks = ['hwc-pos-20251209-tka', 'hwc-pos-20251210-pcy'];
    const withoutStep2Tasks = ['hwc-pos-20251209-vw8', 'hwc-pos-20251210-wxe'];

    for (const taskId of withStep2Tasks) {
        const step2Records = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .find({ task_id: taskId, step: 2 })
            .toArray();

        console.log(`${taskId} (有Step2):`);
        console.log(`  记录数: ${step2Records.length}`);
        if (step2Records.length > 0) {
            const first = step2Records[0];
            console.log(`  首条记录字段: ${Object.keys(first).join(', ')}`);
            console.log(`  period: ${first.period}`);
            console.log(`  condition: ${first.condition}`);
            console.log(`  excluded_count: ${first.excluded_count}`);
            console.log(`  storage_strategy: ${first.storage_strategy}`);
            console.log(`  is_compressed: ${first.is_compressed}`);
        }
        console.log();
    }

    for (const taskId of withoutStep2Tasks) {
        const step2Records = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .find({ task_id: taskId, step: 2 })
            .toArray();

        console.log(`${taskId} (无Step2):`);
        console.log(`  记录数: ${step2Records.length}`);

        // 检查该任务是否有其他Step记录
        const otherSteps = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .aggregate([
                { $match: { task_id: taskId } },
                { $group: { _id: '$step', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]).toArray();

        console.log(`  其他Step记录: ${JSON.stringify(otherSteps)}`);
        console.log();
    }

    // 2. 检查结果中的exclusions_to_save
    console.log('\n=== 结果中的exclusions_to_save检查 ===\n');

    // 获取wxe的结果，检查是否存储了exclusions_to_save
    const wxeResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251210-wxe' });

    if (wxeResult) {
        console.log('wxe 结果字段:', Object.keys(wxeResult).join(', '));
        console.log('wxe exclusions_to_save 存在?', !!wxeResult.exclusions_to_save);
        console.log('wxe positive_selection_details:');
        console.log(JSON.stringify(wxeResult.positive_selection_details, null, 2));
    }

    // 3. 检查output_config配置
    console.log('\n=== output_config.exclusion_details配置检查 ===\n');

    const pcyTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251210-pcy' });
    const wxeTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251210-wxe' });

    console.log('pcy output_config.exclusion_details:');
    console.log(JSON.stringify(pcyTask?.output_config?.exclusion_details, null, 2));

    console.log('\nwxe output_config.exclusion_details:');
    console.log(JSON.stringify(wxeTask?.output_config?.exclusion_details, null, 2));

    // 4. 检查任务的 exclusion_details_status
    console.log('\n=== exclusion_details_status检查 ===\n');

    console.log('pcy exclusion_details_status:', pcyTask?.exclusion_details_status);
    console.log('wxe exclusion_details_status:', wxeTask?.exclusion_details_status);

    // 5. 检查 zone_ratios 在不同热温冷比任务中的情况
    console.log('\n=== zone_ratios与热温冷比关系 ===\n');

    const allTasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: /^hwc-pos-202512/ })
        .toArray();

    for (const task of allTasks) {
        const hwc = task.positive_selection?.red_hot_warm_cold_ratios?.[0];
        const zoneRatios = task.positive_selection?.zone_ratios || [];

        const step2Count = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        const step2Status = step2Count > 0 ? '✅' : '❌';
        const hwcStr = hwc ? `${hwc.hot}:${hwc.warm}:${hwc.cold}` : '(无)';

        console.log(`${task.task_id}: HWC=${hwcStr}, zone_ratios=${JSON.stringify(zoneRatios)}, Step2=${step2Status}`);
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
