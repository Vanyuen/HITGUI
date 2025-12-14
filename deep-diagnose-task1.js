/**
 * 深入诊断任务1结果 - 检查为什么批次边界期号返回0组合
 */
const mongoose = require('mongoose');

async function deepDiagnoseTask1() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const resultSchema = new mongoose.Schema({}, { strict: false });
    const Result = mongoose.model('Result_Deep', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_Deep', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== 深入诊断任务1 (hwc-pos-20251213-od4) ===\n');

    // 1. 检查0组合的期号的完整结果数据
    const criticalPeriods = [25091, 25141, 25142];

    console.log('=== 检查0组合期号的完整结果 ===');
    for (const period of criticalPeriods) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-od4',
            period: period
        }).lean();

        if (result) {
            console.log(`\n期号${period}:`);
            console.log(`  combination_count: ${result.combination_count}`);
            console.log(`  red_combinations长度: ${result.red_combinations?.length || 0}`);
            console.log(`  blue_combinations长度: ${result.blue_combinations?.length || 0}`);
            console.log(`  is_predicted: ${result.is_predicted}`);
            console.log(`  pairing_mode: ${result.pairing_mode}`);

            // 检查positive_selection_details
            if (result.positive_selection_details) {
                console.log('  positive_selection_details:');
                for (const [key, value] of Object.entries(result.positive_selection_details)) {
                    console.log(`    ${key}: ${value}`);
                }
            }

            // 检查exclusion_summary
            if (result.exclusion_summary) {
                console.log('  exclusion_summary:');
                for (const [key, value] of Object.entries(result.exclusion_summary)) {
                    console.log(`    ${key}: ${value}`);
                }
            }

            // 检查hit_analysis
            if (result.hit_analysis && Object.keys(result.hit_analysis).length > 0) {
                console.log('  hit_analysis: 有数据');
            } else {
                console.log('  hit_analysis: 空');
            }
        } else {
            console.log(`\n期号${period}: 未找到结果`);
        }
    }

    // 2. 检查正常期号的结果作为对比
    console.log('\n\n=== 对比正常期号 (25089, 25090, 25092, 25093) ===');
    const normalPeriods = [25089, 25090, 25092, 25093];

    for (const period of normalPeriods) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-od4',
            period: period
        }).lean();

        if (result) {
            console.log(`期号${period}: combination_count=${result.combination_count}`);
            if (result.positive_selection_details) {
                console.log(`  step1_count=${result.positive_selection_details.step1_count}`);
            }
        } else {
            console.log(`期号${period}: 未找到结果`);
        }
    }

    // 3. 检查HWC数据是否存在
    console.log('\n\n=== 检查批次边界期号的HWC数据 ===');
    const hwcPairs = [
        { base: '25090', target: '25091' }, // 批次1边界
        { base: '25140', target: '25141' }, // 批次2边界
        { base: '25141', target: '25142' }, // 推算期
    ];

    for (const pair of hwcPairs) {
        const hwcData = await HwcOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        }).lean();

        if (hwcData) {
            const ratioCount = Object.keys(hwcData.hot_warm_cold_data || {}).length;
            let totalCombos = 0;
            for (const ids of Object.values(hwcData.hot_warm_cold_data || {})) {
                totalCombos += ids.length;
            }
            console.log(`${pair.base}->${pair.target}: ✅ HWC数据存在 (${ratioCount}种比例, ${totalCombos}个组合)`);

            // 检查是否有3:1:1比例
            const ratio311 = hwcData.hot_warm_cold_data?.['3:1:1'];
            console.log(`  3:1:1比例: ${ratio311 ? `${ratio311.length}个组合` : '不存在'}`);
        } else {
            console.log(`${pair.base}->${pair.target}: ❌ HWC数据不存在`);
        }
    }

    // 4. 对比正常期号的HWC数据
    console.log('\n=== 对比正常期号的HWC数据 ===');
    const normalHwcPairs = [
        { base: '25088', target: '25089' },
        { base: '25089', target: '25090' },
        { base: '25091', target: '25092' },
    ];

    for (const pair of normalHwcPairs) {
        const hwcData = await HwcOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        }).lean();

        if (hwcData) {
            const ratio311 = hwcData.hot_warm_cold_data?.['3:1:1'];
            console.log(`${pair.base}->${pair.target}: ✅ (3:1:1比例: ${ratio311 ? ratio311.length : 0}个组合)`);
        } else {
            console.log(`${pair.base}->${pair.target}: ❌`);
        }
    }

    await mongoose.disconnect();
}

deepDiagnoseTask1().catch(e => { console.error(e); process.exit(1); });
