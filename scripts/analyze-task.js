const mongoose = require('mongoose');

async function analyzeTask() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const taskId = 'hwc-pos-20251128-9y3';

    // 获取有数据的结果记录
    const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: taskId })
        .sort({ combination_count: -1 })
        .limit(5)
        .toArray();

    console.log('=== 组合数最多的5期 ===');
    for (const result of results) {
        console.log('---');
        console.log('期号:', result.period);
        console.log('red_combinations数量:', result.red_combinations?.length || 0);
        console.log('combination_count:', result.combination_count);

        if (result.exclusion_summary) {
            const summary = result.exclusion_summary;
            console.log('正选后数量:', summary.positive_selection_count);
            console.log('最终数量:', summary.final_count);
        }

        if (result.positive_selection_details) {
            const details = result.positive_selection_details;
            console.log('Step1数量:', details.step1_count);
            console.log('Step2数量:', details.step2_retained_count);
            console.log('最终正选数量:', details.final_retained_count);
        }
    }

    // 分析排除详情数据量
    console.log('\n=== 排除详情数据量分析 ===');

    // 假设Step1从324632开始筛选
    // Step2-6逐步排除，每步可能排除数万
    // 需要保存的排除详情 = 排除数量 × 每条记录大小

    // 获取一条详细数据分析
    const sampleResult = results[0];
    if (sampleResult && sampleResult.positive_selection_details) {
        const step1 = sampleResult.positive_selection_details.step1_count || 0;
        const step2 = sampleResult.positive_selection_details.step2_retained_count || step1;
        const step3 = sampleResult.positive_selection_details.step3_retained_count || step2;
        const step4 = sampleResult.positive_selection_details.step4_retained_count || step3;
        const step5 = sampleResult.positive_selection_details.step5_retained_count || step4;
        const step6 = sampleResult.positive_selection_details.step6_retained_count || step5;

        console.log('\n单期排除数量估算:');
        console.log('  Step2排除:', step1 - step2);
        console.log('  Step3排除:', step2 - step3);
        console.log('  Step4排除:', step3 - step4);
        console.log('  Step5排除:', step4 - step5);
        console.log('  Step6排除:', step5 - step6);

        const totalExcluded = (step1 - step2) + (step2 - step3) + (step3 - step4) + (step4 - step5) + (step5 - step6);
        console.log('  单期总排除:', totalExcluded);
        console.log('  101期总排除:', totalExcluded * 101);

        // 每条排除记录大小估算
        // { combination_id: 6位数字, details: ~200字节 } ≈ 250字节
        const avgRecordSize = 250;
        const totalSize = totalExcluded * 101 * avgRecordSize;
        console.log('  预估数据量:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
    }

    await mongoose.disconnect();
}

analyzeTask().catch(console.error);
