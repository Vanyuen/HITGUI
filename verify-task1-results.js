/**
 * 验证新任务1结果 - 检查批次边界期号25091和25141
 */
const mongoose = require('mongoose');

async function verifyTask1Results() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const resultSchema = new mongoose.Schema({}, { strict: false });
    const Result = mongoose.model('Result3', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

    console.log('=== 验证新任务1结果 (hwc-pos-20251213-od4) ===\n');

    // 关键期号: 25091 (批次1末), 25141 (批次2末), 25142 (推算期)
    const criticalPeriods = ['25091', '25141', '25142'];

    console.log('关键期号 (原批次边界Bug期):');
    for (const issue of criticalPeriods) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-od4',
            period: parseInt(issue)
        }).lean();

        if (result) {
            console.log(`  期号${issue}: combination_count=${result.combination_count}, red_combinations长度=${result.red_combinations?.length || 0}`);
        } else {
            console.log(`  期号${issue}: 未找到结果`);
        }
    }

    // 对比原始任务1
    console.log('\n原始任务1 (hwc-pos-20251213-ykt) 对比:');
    for (const issue of criticalPeriods) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-ykt',
            period: parseInt(issue)
        }).lean();

        if (result) {
            console.log(`  期号${issue}: combination_count=${result.combination_count}`);
        } else {
            console.log(`  期号${issue}: 未找到结果`);
        }
    }

    // 统计任务总结
    const newTaskResults = await Result.find({ task_id: 'hwc-pos-20251213-od4' }).lean();
    const zeroResults = newTaskResults.filter(r => r.combination_count === 0);
    console.log('\n=== 任务统计 ===');
    console.log(`总期数: ${newTaskResults.length}`);
    console.log(`0组合期数: ${zeroResults.length}`);
    if (zeroResults.length > 0) {
        console.log(`0组合期号: ${zeroResults.map(r => r.period).join(', ')}`);
    }

    await mongoose.disconnect();
}

verifyTask1Results().catch(e => { console.error(e); process.exit(1); });
