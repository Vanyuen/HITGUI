const mongoose = require('mongoose');

async function diagnoseMissingHwc() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 诊断缺失的HWC数据 ===\n');

    // 1. 检查25114-25115的HWC数据
    const hwc25115 = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({
            base_issue: '25114',
            target_issue: '25115'
        });

    if (hwc25115) {
        console.log('25114→25115 HWC数据: ✅ 存在');
        console.log('  4:1:0组合数:', hwc25115.hot_warm_cold_data?.['4:1:0']?.length || 0);
    } else {
        console.log('25114→25115 HWC数据: ❌ 不存在');
    }

    // 2. 列出25110-25120范围内的所有HWC数据
    console.log('\n=== 检查25110-25120范围的HWC数据 ===');
    const hwcRange = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({
            $or: [
                { base_issue: { $gte: '25110', $lte: '25120' } },
                { target_issue: { $gte: '25110', $lte: '25120' } }
            ]
        })
        .sort({ base_issue: 1 })
        .toArray();

    console.log('找到的HWC数据条数:', hwcRange.length);
    hwcRange.forEach(d => {
        console.log(`  ${d.base_issue}→${d.target_issue}`);
    });

    // 3. 检查任务结果中的positive_selection_details
    console.log('\n=== 检查任务结果的positive_selection_details ===');

    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    console.log('最新任务ID:', task.task_id);
    console.log('任务创建时间:', task.created_at);
    console.log('正选过滤条件:', JSON.stringify(task.positive_selection_filters || {}, null, 2));

    // 获取该任务的所有结果
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .sort({ period: 1 })
        .toArray();

    console.log('\n任务结果总数:', results.length);

    // 显示每个期号的统计
    console.log('\n=== 各期号结果详情 ===');

    let withCombos = 0;
    let withoutCombos = 0;

    for (const r of results) {
        const comboCount = r.red_combinations?.length || 0;
        const details = r.positive_selection_details || {};
        const step1 = details.step1_count;

        if (comboCount > 0) {
            withCombos++;
            console.log(`✅ ${r.period}: ${comboCount}个组合, step1=${step1}`);
        } else {
            withoutCombos++;
            // 显示完整的positive_selection_details
            console.log(`❌ ${r.period}: 0个组合, positive_selection_details=${JSON.stringify(details)}`);
        }
    }

    console.log('\n=== 统计 ===');
    console.log('有组合的期号数:', withCombos);
    console.log('无组合的期号数:', withoutCombos);

    // 4. 检查positive_selection_details中缺失哪些字段
    console.log('\n=== 分析positive_selection_details结构 ===');

    const withDetails = results.filter(r => r.positive_selection_details?.step1_count !== undefined);
    const withoutDetails = results.filter(r => r.positive_selection_details?.step1_count === undefined);

    console.log('有step1_count的期号数:', withDetails.length);
    console.log('无step1_count的期号数:', withoutDetails.length);

    if (withDetails.length > 0) {
        console.log('\n有step1_count的期号样例:');
        const sample = withDetails[0];
        console.log('  期号:', sample.period);
        console.log('  positive_selection_details:', JSON.stringify(sample.positive_selection_details));
    }

    if (withoutDetails.length > 0) {
        console.log('\n无step1_count的期号样例:');
        const sample = withoutDetails[0];
        console.log('  期号:', sample.period);
        console.log('  positive_selection_details:', JSON.stringify(sample.positive_selection_details));
    }

    // 5. 检查是否有error字段
    console.log('\n=== 检查错误字段 ===');
    const withErrors = results.filter(r => r.error);
    console.log('有错误的期号数:', withErrors.length);
    if (withErrors.length > 0) {
        withErrors.slice(0, 5).forEach(r => {
            console.log(`  ${r.period}: ${r.error}`);
        });
    }

    await mongoose.disconnect();
}

diagnoseMissingHwc().catch(console.error);
