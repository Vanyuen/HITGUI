const mongoose = require('mongoose');

async function simulateApplyPositiveSelection() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 模拟 applyPositiveSelection 函数 ===\n');

    // 1. 加载红球组合缓存
    console.log('1. 加载红球组合缓存...');
    const redCombinations = await mongoose.connection.db.collection('hit_dlt_redcombinations')
        .find({})
        .limit(100)  // 只取100个用于测试
        .toArray();
    console.log('   红球组合数:', redCombinations.length);

    // 2. 模拟正选条件 (来自任务)
    const positiveSelection = {
        red_hot_warm_cold_ratios: [
            { hot: 4, warm: 1, cold: 0 }
        ],
        zone_ratios: ['2:1:2'],
        sum_ranges: [{ min: 47, max: 123 }],
        span_ranges: [{ min: 14, max: 34 }],
        odd_even_ratios: ['2:3', '3:2'],
        ac_values: [4, 5, 6]
    };

    // 3. 检查 red_hot_warm_cold_ratios 转换
    console.log('\n2. 检查热温冷比参数...');
    const selectedHwcRatios = positiveSelection.red_hot_warm_cold_ratios || [];
    console.log('   selectedHwcRatios:', JSON.stringify(selectedHwcRatios));

    if (selectedHwcRatios.length === 0) {
        console.log('   ❌ 热温冷比为空，会抛出异常!');
        return;
    }

    // 4. 模拟HWC缓存查询
    console.log('\n3. 模拟HWC缓存查询...');

    const testPairs = [
        { base: '25094', target: '25095' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    for (const pair of testPairs) {
        const hwcKey = `${pair.base}-${pair.target}`;

        // 从数据库加载HWC数据
        const hwcData = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .findOne({
                base_issue: pair.base,
                target_issue: pair.target
            });

        if (hwcData && hwcData.hot_warm_cold_data) {
            // 模拟转换ratio对象为字符串
            const selectedRatioKeys = selectedHwcRatios.map(r => {
                if (typeof r === 'string') {
                    return r;
                } else {
                    return `${r.hot}:${r.warm}:${r.cold}`;
                }
            });

            console.log(`   ${hwcKey}:`);
            console.log(`     selectedRatioKeys:`, selectedRatioKeys);

            // 检查数据
            let candidateCount = 0;
            for (const ratioKey of selectedRatioKeys) {
                const ids = hwcData.hot_warm_cold_data[ratioKey] || [];
                candidateCount += ids.length;
                console.log(`     热温冷比 "${ratioKey}": ${ids.length}个组合`);
            }
            console.log(`     总候选组合: ${candidateCount}`);
        } else {
            console.log(`   ${hwcKey}: ❌ 无HWC数据`);
        }
    }

    // 5. 检查实际结果数据
    console.log('\n4. 检查实际任务结果...');

    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    // 检查推算期和已开奖期的区别
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: task.task_id })
        .sort({ period: -1 })
        .limit(5)
        .toArray();

    console.log('\n   最后5期结果对比:');
    for (const r of results) {
        const isPredicted = r.is_predicted;
        const comboCount = r.red_combinations?.length || 0;
        const step1 = r.positive_selection_details?.step1_count;

        console.log(`   ${r.period}: is_predicted=${isPredicted}, combos=${comboCount}, step1_count=${step1}`);
    }

    // 6. 关键检查: 看第一期25095的baseIssue
    console.log('\n5. 检查第一期处理...');
    const result25095 = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: task.task_id, period: '25095' });

    if (result25095) {
        console.log('   期号 25095:');
        console.log('     red_combinations.length:', result25095.red_combinations?.length);
        console.log('     positive_selection_details:', JSON.stringify(result25095.positive_selection_details));
        console.log('     exclusion_summary:', JSON.stringify(result25095.exclusion_summary));
        console.log('     error:', result25095.error);
    }

    await mongoose.disconnect();
}

simulateApplyPositiveSelection().catch(console.error);
