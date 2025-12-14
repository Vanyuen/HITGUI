/**
 * 关键诊断：检查Step2数据大小估算与存储策略选择
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=============================================');
    console.log('诊断：Step2数据大小估算与存储策略');
    console.log('=============================================\n');

    // 对比有Step2和无Step2任务的存储情况

    // 有Step2的任务
    const tasksWithStep2 = ['hwc-pos-20251209-tka', 'hwc-pos-20251210-pcy', 'hwc-pos-20251208-686'];
    // 无Step2的任务
    const tasksWithoutStep2 = ['hwc-pos-20251209-vw8', 'hwc-pos-20251210-wxe', 'hwc-pos-20251203-23k'];

    console.log('=== 有Step2的任务存储详情 ===\n');

    for (const taskId of tasksWithStep2) {
        const step2 = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .findOne({ task_id: taskId, step: 2 });

        if (step2) {
            console.log(`${taskId}:`);
            console.log(`  excluded_count: ${step2.excluded_count}`);
            console.log(`  storage_strategy: ${step2.storage_strategy}`);
            console.log(`  is_compressed: ${step2.is_compressed}`);
            console.log(`  original_size: ${step2.original_size ? (step2.original_size / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`);
            console.log(`  compressed_size: ${step2.compressed_size ? (step2.compressed_size / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`);
            console.log(`  compression_ratio: ${step2.compression_ratio}%`);
            console.log();
        }
    }

    console.log('=== 无Step2的任务其他Step存储详情 ===\n');

    for (const taskId of tasksWithoutStep2) {
        // 获取其他Step看存储策略
        const otherStep = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .findOne({ task_id: taskId });

        if (otherStep) {
            console.log(`${taskId}:`);
            console.log(`  (Step ${otherStep.step}) excluded_count: ${otherStep.excluded_count}`);
            console.log(`  storage_strategy: ${otherStep.storage_strategy}`);
            console.log(`  is_compressed: ${otherStep.is_compressed}`);
            console.log(`  original_size: ${otherStep.original_size ? (otherStep.original_size / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`);
            console.log();
        }

        // 检查该任务的Step2排除数量
        const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: taskId });
        if (result) {
            const step1 = result.positive_selection_details?.step1_count || 0;
            const step2Retained = result.positive_selection_details?.step2_retained_count || 0;
            const excluded = step1 - step2Retained;
            // 估算大小（每个ID约6字节 + JSON开销）
            const estimatedSize = excluded * 7;
            console.log(`  Step2 应排除: ${excluded} 个ID`);
            console.log(`  Step2 估算大小: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
            console.log();
        }
    }

    // 检查 tka 和 vw8 的 Step2 应排除数量对比
    console.log('=== tka vs vw8 Step2排除数量对比 ===\n');

    const tkaResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-tka' });
    const vw8Result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-vw8' });

    if (tkaResult && vw8Result) {
        const tkaStep1 = tkaResult.positive_selection_details?.step1_count || 0;
        const tkaStep2 = tkaResult.positive_selection_details?.step2_retained_count || 0;
        const tkaExcluded = tkaStep1 - tkaStep2;

        const vw8Step1 = vw8Result.positive_selection_details?.step1_count || 0;
        const vw8Step2 = vw8Result.positive_selection_details?.step2_retained_count || 0;
        const vw8Excluded = vw8Step1 - vw8Step2;

        console.log(`tka: Step1=${tkaStep1}, Step2后=${tkaStep2}, 排除=${tkaExcluded}`);
        console.log(`vw8: Step1=${vw8Step1}, Step2后=${vw8Step2}, 排除=${vw8Excluded}`);

        // 实际存储的Step2数据
        const tkaStep2Doc = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .findOne({ task_id: 'hwc-pos-20251209-tka', step: 2 });

        if (tkaStep2Doc) {
            console.log(`\ntka Step2 实际存储:`);
            console.log(`  excluded_count: ${tkaStep2Doc.excluded_count}`);
            console.log(`  原始大小: ${(tkaStep2Doc.original_size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  压缩后: ${(tkaStep2Doc.compressed_size / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
