/**
 * 关键诊断：检查不同zone_ratios配置下Step2排除数量
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=============================================');
    console.log('诊断：zone_ratios配置与Step2排除数量的关系');
    console.log('=============================================\n');

    // 获取所有任务
    const tasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: /^hwc-pos-202512/ })
        .sort({ created_at: 1 })
        .toArray();

    console.log('=== 关键对比：Step2排除数量 ===\n');
    console.log('任务ID'.padEnd(28) + ' | zone_ratio | Step1后 | Step2后 | 排除数 | Step2记录');
    console.log('-'.repeat(95));

    for (const task of tasks) {
        const zoneRatio = task.positive_selection?.zone_ratios?.[0] || '(无)';

        // 获取任意一期结果检查
        const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: task.task_id });

        const step1Count = result?.positive_selection_details?.step1_count || 0;
        const step2Retained = result?.positive_selection_details?.step2_retained_count || 0;
        const excludedCount = step1Count - step2Retained;

        // 查询Step2记录数
        const step2Records = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        const step2Status = step2Records > 0 ? `✅ ${step2Records}` : '❌ 0';

        console.log(
            task.task_id.padEnd(28) + ' | ' +
            zoneRatio.padEnd(10) + ' | ' +
            String(step1Count).padStart(7) + ' | ' +
            String(step2Retained).padStart(7) + ' | ' +
            String(excludedCount).padStart(6) + ' | ' +
            step2Status
        );
    }

    // 关键发现
    console.log('\n\n=== 关键发现 ===\n');

    // 统计zone_ratio与Step2记录的关系
    const zoneRatioStats = {};
    for (const task of tasks) {
        const zoneRatio = task.positive_selection?.zone_ratios?.[0] || '(无)';
        const step2Records = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        if (!zoneRatioStats[zoneRatio]) {
            zoneRatioStats[zoneRatio] = { withStep2: [], withoutStep2: [] };
        }

        if (step2Records > 0) {
            zoneRatioStats[zoneRatio].withStep2.push(task.task_id);
        } else {
            zoneRatioStats[zoneRatio].withoutStep2.push(task.task_id);
        }
    }

    for (const [zoneRatio, stats] of Object.entries(zoneRatioStats)) {
        console.log(`zone_ratio "${zoneRatio}":`);
        console.log(`  有Step2: ${stats.withStep2.length} 个`);
        console.log(`  无Step2: ${stats.withoutStep2.length} 个`);
        if (stats.withStep2.length > 0 && stats.withoutStep2.length > 0) {
            // 找出有Step2的最后一个和无Step2的第一个
            console.log(`  有Step2最后一个: ${stats.withStep2[stats.withStep2.length - 1]}`);
            console.log(`  无Step2第一个: ${stats.withoutStep2[0]}`);
        }
        console.log();
    }

    // 检查 2:2:1 zone_ratio 的任务是否被排除的组合数量不同
    console.log('=== 对比排除数量差异 ===\n');

    const ratio221Tasks = tasks.filter(t => t.positive_selection?.zone_ratios?.[0] === '2:2:1');
    const ratio212Tasks = tasks.filter(t => t.positive_selection?.zone_ratios?.[0] === '2:1:2');

    console.log('zone_ratio "2:2:1" 任务的Step2排除数量:');
    for (const task of ratio221Tasks) {
        const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: task.task_id });
        const step1Count = result?.positive_selection_details?.step1_count || 0;
        const step2Retained = result?.positive_selection_details?.step2_retained_count || 0;
        const excludedCount = step1Count - step2Retained;
        console.log(`  ${task.task_id}: ${excludedCount} 个 (${step1Count} → ${step2Retained})`);
    }

    console.log('\nzone_ratio "2:1:2" 任务的Step2排除数量:');
    for (const task of ratio212Tasks) {
        const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: task.task_id });
        const step1Count = result?.positive_selection_details?.step1_count || 0;
        const step2Retained = result?.positive_selection_details?.step2_retained_count || 0;
        const excludedCount = step1Count - step2Retained;
        console.log(`  ${task.task_id}: ${excludedCount} 个 (${step1Count} → ${step2Retained})`);
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
