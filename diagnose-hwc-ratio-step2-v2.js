/**
 * 深入诊断：Step2数据丢失与热温冷比的关系
 */

const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=============================================');
    console.log('深入诊断：Step2数据丢失与热温冷比配置');
    console.log('=============================================\n');

    // 获取所有任务
    const tasks = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({ task_id: /^hwc-pos-202512/ })
        .sort({ created_at: 1 })
        .toArray();

    console.log('=== 热温冷比配置与Step2状态对比 ===\n');
    console.log('任务ID'.padEnd(28) + ' | 热温冷比(H:W:C) | Step2 | 创建时间');
    console.log('-'.repeat(90));

    const results = [];

    for (const task of tasks) {
        // 获取热温冷比配置
        const hwcConfig = task.positive_selection?.red_hot_warm_cold_ratios || [];
        let hwcStr = '(无)';
        if (hwcConfig.length > 0) {
            const first = hwcConfig[0];
            hwcStr = `${first.hot}:${first.warm}:${first.cold}`;
            if (hwcConfig.length > 1) hwcStr += ` (+${hwcConfig.length - 1})`;
        }

        // 查询Step2记录数
        const step2Count = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
            .countDocuments({ task_id: task.task_id, step: 2 });

        const step2Status = step2Count > 0 ? `✅ ${step2Count}` : '❌ 0';
        const createdAt = task.created_at ? new Date(task.created_at).toISOString().slice(0, 19) : '(无)';

        console.log(
            task.task_id.padEnd(28) + ' | ' +
            hwcStr.padEnd(15) + ' | ' +
            step2Status.padEnd(6) + ' | ' +
            createdAt
        );

        results.push({
            task_id: task.task_id,
            hwc_config: hwcConfig,
            step2_count: step2Count,
            created_at: task.created_at
        });
    }

    // 按热温冷比分组分析
    console.log('\n\n=== 按热温冷比分组统计 ===\n');

    const groupByHWC = {};
    for (const r of results) {
        const key = r.hwc_config.length > 0
            ? `${r.hwc_config[0].hot}:${r.hwc_config[0].warm}:${r.hwc_config[0].cold}`
            : '(无)';
        if (!groupByHWC[key]) {
            groupByHWC[key] = { withStep2: 0, withoutStep2: 0, tasks: [] };
        }
        if (r.step2_count > 0) {
            groupByHWC[key].withStep2++;
        } else {
            groupByHWC[key].withoutStep2++;
        }
        groupByHWC[key].tasks.push(r.task_id);
    }

    for (const [hwc, data] of Object.entries(groupByHWC)) {
        console.log(`热温冷比 ${hwc}:`);
        console.log(`  有Step2: ${data.withStep2} 个任务`);
        console.log(`  缺Step2: ${data.withoutStep2} 个任务`);
        console.log(`  任务列表: ${data.tasks.join(', ')}`);
        console.log();
    }

    // 检查连续任务之间的差异
    console.log('\n=== 连续任务创建时间间隔分析 ===\n');

    for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];

        const prevTime = new Date(prev.created_at);
        const currTime = new Date(curr.created_at);
        const diffMs = currTime - prevTime;
        const diffSec = Math.round(diffMs / 1000);

        const prevHasStep2 = prev.step2_count > 0;
        const currHasStep2 = curr.step2_count > 0;

        // 只显示从有Step2变为无Step2的临界点
        if (prevHasStep2 && !currHasStep2) {
            console.log(`⚠️ 临界点: ${prev.task_id} (✅) → ${curr.task_id} (❌)`);
            console.log(`   时间间隔: ${diffSec}秒`);

            // 获取两个任务的完整配置
            const prevTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
                .findOne({ task_id: prev.task_id });
            const currTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
                .findOne({ task_id: curr.task_id });

            console.log(`   前任务热温冷比: ${JSON.stringify(prevTask.positive_selection?.red_hot_warm_cold_ratios?.[0])}`);
            console.log(`   后任务热温冷比: ${JSON.stringify(currTask.positive_selection?.red_hot_warm_cold_ratios?.[0])}`);
            console.log();
        }
    }

    // 对比 pcy (有Step2) 和 wxe (无Step2) 的详细差异
    console.log('\n=== 对比最新任务: pcy (有Step2) vs wxe (无Step2) ===\n');

    const pcyTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251210-pcy' });
    const wxeTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251210-wxe' });

    if (pcyTask && wxeTask) {
        console.log('pcy (有Step2):');
        console.log('  red_hot_warm_cold_ratios:', JSON.stringify(pcyTask.positive_selection?.red_hot_warm_cold_ratios));
        console.log('  zone_ratios:', JSON.stringify(pcyTask.positive_selection?.zone_ratios));
        console.log('  created_at:', pcyTask.created_at);

        console.log('\nwxe (无Step2):');
        console.log('  red_hot_warm_cold_ratios:', JSON.stringify(wxeTask.positive_selection?.red_hot_warm_cold_ratios));
        console.log('  zone_ratios:', JSON.stringify(wxeTask.positive_selection?.zone_ratios));
        console.log('  created_at:', wxeTask.created_at);

        // 检查结果中的 step2 统计
        const pcyResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: 'hwc-pos-20251210-pcy' });
        const wxeResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .findOne({ task_id: 'hwc-pos-20251210-wxe' });

        console.log('\npcy 结果 step2 统计:');
        if (pcyResult) {
            console.log('  step2_retained_count:', pcyResult.positive_selection_details?.step2_retained_count);
            console.log('  step2_excluded_count:', pcyResult.positive_selection_details?.step2_excluded_count);
        }

        console.log('\nwxe 结果 step2 统计:');
        if (wxeResult) {
            console.log('  step2_retained_count:', wxeResult.positive_selection_details?.step2_retained_count);
            console.log('  step2_excluded_count:', wxeResult.positive_selection_details?.step2_excluded_count);
        }
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
