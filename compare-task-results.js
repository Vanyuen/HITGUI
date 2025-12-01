const mongoose = require('mongoose');

async function compareTaskResults() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 对比不同任务的结果 ===\n');

    // 问题任务
    const badTaskId = 'hwc-pos-20251129-xge';
    // 正常任务
    const goodTaskId = 'hwc-pos-20251129-2ia';

    // 1. 获取问题任务的一条结果
    console.log('=== 问题任务 (hwc-pos-20251129-xge) ===');
    const badResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: badTaskId })
        .limit(3)
        .toArray();

    console.log('结果数量:', badResults.length);
    badResults.forEach((r, i) => {
        console.log(`\n结果 ${i + 1}:`);
        console.log('  所有字段:', Object.keys(r).join(', '));
        console.log('  period:', r.period);
        console.log('  target_issue:', r.target_issue);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  red_combinations.length:', r.red_combinations?.length);
    });

    // 2. 获取正常任务的一条结果
    console.log('\n=== 正常任务 (hwc-pos-20251129-2ia) ===');
    const goodResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: goodTaskId })
        .limit(3)
        .toArray();

    console.log('结果数量:', goodResults.length);
    goodResults.forEach((r, i) => {
        console.log(`\n结果 ${i + 1}:`);
        console.log('  所有字段:', Object.keys(r).join(', '));
        console.log('  period:', r.period);
        console.log('  target_issue:', r.target_issue);
        console.log('  is_predicted:', r.is_predicted);
        console.log('  red_combinations.length:', r.red_combinations?.length);
    });

    // 3. 检查两个任务的配置
    console.log('\n=== 任务配置对比 ===');

    const badTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: badTaskId });

    const goodTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: goodTaskId });

    console.log('\n问题任务配置:');
    console.log('  created_at:', badTask.created_at);
    console.log('  period_range:', JSON.stringify(badTask.period_range));
    console.log('  positive_selection (keys):', Object.keys(badTask.positive_selection || {}));
    console.log('  red_hot_warm_cold_ratios:', JSON.stringify(badTask.positive_selection?.red_hot_warm_cold_ratios));

    console.log('\n正常任务配置:');
    console.log('  created_at:', goodTask.created_at);
    console.log('  period_range:', JSON.stringify(goodTask.period_range));
    console.log('  positive_selection (keys):', Object.keys(goodTask.positive_selection || {}));
    console.log('  red_hot_warm_cold_ratios:', JSON.stringify(goodTask.positive_selection?.red_hot_warm_cold_ratios));

    // 4. 检查问题任务中有组合的那一条记录
    console.log('\n=== 问题任务中有组合的记录 ===');
    const withCombos = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({
            task_id: badTaskId,
            'red_combinations.0': { $exists: true }
        });

    if (withCombos) {
        console.log('  period:', withCombos.period);
        console.log('  is_predicted:', withCombos.is_predicted);
        console.log('  red_combinations.length:', withCombos.red_combinations?.length);
        console.log('  positive_selection_details:', JSON.stringify(withCombos.positive_selection_details));
    }

    // 5. 检查问题任务中无组合的记录
    console.log('\n=== 问题任务中无组合的记录样例 ===');
    const withoutCombos = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({
            task_id: badTaskId,
            $or: [
                { red_combinations: { $size: 0 } },
                { red_combinations: { $exists: false } }
            ]
        });

    if (withoutCombos) {
        console.log('  period:', withoutCombos.period);
        console.log('  is_predicted:', withoutCombos.is_predicted);
        console.log('  red_combinations:', withoutCombos.red_combinations);
        console.log('  positive_selection_details:', JSON.stringify(withoutCombos.positive_selection_details));
        console.log('  error:', withoutCombos.error);
        console.log('  exclusion_summary:', JSON.stringify(withoutCombos.exclusion_summary));
    }

    await mongoose.disconnect();
}

compareTaskResults().catch(console.error);
