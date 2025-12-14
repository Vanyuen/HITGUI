/**
 * 诊断：热温冷比选择与Step2数据丢失的关联
 *
 * 用户观察到的规律：
 * - 选择 3:1:1 热温冷比的任务有 Step2 数据
 * - 选择其他热温冷比（如 2:2:1）的任务缺失 Step2 数据
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=============================================');
    console.log('诊断：热温冷比选择与Step2数据丢失的关联');
    console.log('=============================================\n');

    // 1. 获取所有 hwc-pos 任务及其热温冷比配置
    const tasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: /^hwc-pos-202512/ })
        .sort({ created_at: 1 })
        .toArray();

    console.log('=== 任务热温冷比配置与Step2状态对比 ===\n');
    console.log('任务ID'.padEnd(28) + ' | 热温冷比配置 | Step2记录数 | zone_ratios数量');
    console.log('-'.repeat(80));

    const results = [];

    for (const task of tasks) {
        // 获取热温冷比配置
        const hwcRatios = task.positive_selection?.hwc_ratios || [];
        const hwcRatioStr = hwcRatios.length > 0 ? hwcRatios.slice(0, 3).join(', ') + (hwcRatios.length > 3 ? '...' : '') : '(无)';

        // 获取区间比配置
        const zoneRatios = task.positive_selection?.zone_ratios || [];

        // 查询Step2记录数
        const step2Count = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        const step2Status = step2Count > 0 ? '✅ ' + step2Count : '❌ 0';

        console.log(
            task.task_id.padEnd(28) + ' | ' +
            hwcRatioStr.padEnd(12) + ' | ' +
            step2Status.padEnd(11) + ' | ' +
            zoneRatios.length
        );

        results.push({
            task_id: task.task_id,
            hwc_ratios: hwcRatios,
            zone_ratios: zoneRatios,
            step2_count: step2Count,
            created_at: task.created_at
        });
    }

    // 2. 分析规律
    console.log('\n\n=== 规律分析 ===\n');

    const withStep2 = results.filter(r => r.step2_count > 0);
    const withoutStep2 = results.filter(r => r.step2_count === 0);

    console.log('有Step2数据的任务:');
    withStep2.forEach(r => {
        console.log(`  ${r.task_id}: hwc_ratios=${JSON.stringify(r.hwc_ratios.slice(0, 5))}, zone_ratios数量=${r.zone_ratios.length}`);
    });

    console.log('\n缺失Step2数据的任务:');
    withoutStep2.forEach(r => {
        console.log(`  ${r.task_id}: hwc_ratios=${JSON.stringify(r.hwc_ratios.slice(0, 5))}, zone_ratios数量=${r.zone_ratios.length}`);
    });

    // 3. 检查 zone_ratios 配置差异
    console.log('\n\n=== zone_ratios 配置详情对比 ===\n');

    // 找一个有Step2的任务
    const taskWithStep2 = withStep2[0];
    // 找一个没有Step2的任务
    const taskWithoutStep2 = withoutStep2[0];

    if (taskWithStep2) {
        const fullTask1 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({ task_id: taskWithStep2.task_id });
        console.log(`有Step2 (${taskWithStep2.task_id}):`);
        console.log(`  zone_ratios: ${JSON.stringify(fullTask1.positive_selection?.zone_ratios)}`);
        console.log(`  zone_ratios 数量: ${fullTask1.positive_selection?.zone_ratios?.length || 0}`);
    }

    if (taskWithoutStep2) {
        const fullTask2 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({ task_id: taskWithoutStep2.task_id });
        console.log(`\n缺失Step2 (${taskWithoutStep2.task_id}):`);
        console.log(`  zone_ratios: ${JSON.stringify(fullTask2.positive_selection?.zone_ratios)}`);
        console.log(`  zone_ratios 数量: ${fullTask2.positive_selection?.zone_ratios?.length || 0}`);
    }

    // 4. 检查 positive_selection 完整配置
    console.log('\n\n=== positive_selection 完整配置对比 ===\n');

    if (taskWithStep2) {
        const fullTask1 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({ task_id: taskWithStep2.task_id });
        console.log(`有Step2 (${taskWithStep2.task_id}) positive_selection:`);
        console.log(JSON.stringify(fullTask1.positive_selection, null, 2));
    }

    if (taskWithoutStep2) {
        const fullTask2 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({ task_id: taskWithoutStep2.task_id });
        console.log(`\n缺失Step2 (${taskWithoutStep2.task_id}) positive_selection:`);
        console.log(JSON.stringify(fullTask2.positive_selection, null, 2));
    }

    // 5. 检查结果中的 step2_excluded_count
    console.log('\n\n=== 结果中的 step2 排除统计 ===\n');

    if (taskWithStep2) {
        const result1 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: taskWithStep2.task_id, period: 25141 });
        if (result1) {
            console.log(`有Step2 (${taskWithStep2.task_id}) 25141期:`);
            console.log(`  step2_retained_count: ${result1.positive_selection_details?.step2_retained_count}`);
            console.log(`  step2_excluded_count: ${result1.positive_selection_details?.step2_excluded_count}`);
        }
    }

    if (taskWithoutStep2) {
        const result2 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: taskWithoutStep2.task_id, period: 25141 });
        if (result2) {
            console.log(`\n缺失Step2 (${taskWithoutStep2.task_id}) 25141期:`);
            console.log(`  step2_retained_count: ${result2.positive_selection_details?.step2_retained_count}`);
            console.log(`  step2_excluded_count: ${result2.positive_selection_details?.step2_excluded_count}`);
        }
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
