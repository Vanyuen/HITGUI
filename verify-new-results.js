/**
 * 验证新任务结果 - 检查25141期是否不再为0
 */
const mongoose = require('mongoose');

async function verifyNewTaskResults() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const resultSchema = new mongoose.Schema({}, { strict: false });
    const Result = mongoose.model('Result2', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

    console.log('=== 验证新任务结果 ===\n');

    // 新任务2: hwc-pos-20251213-7ww
    const newTask2Issues = ['25141', '25142'];
    for (const issue of newTask2Issues) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-7ww',
            period: parseInt(issue)
        }).lean();

        if (result) {
            console.log(`新任务2 期号${issue}: combination_count=${result.combination_count}`);
            console.log(`  step1_count=${result.step1_count || 'N/A'}`);
            console.log(`  red_combinations长度: ${result.red_combinations?.length || 0}`);
        } else {
            console.log(`新任务2 期号${issue}: 未找到结果`);
        }
    }

    // 对比原始任务2
    console.log('\n=== 对比原始任务2结果 ===');
    const oldResult = await Result.findOne({
        task_id: 'hwc-pos-20251213-7pg',
        period: 25141
    }).lean();

    if (oldResult) {
        console.log(`原始任务2 期号25141: combination_count=${oldResult.combination_count}`);
    }

    // 对比原始任务1
    console.log('\n=== 对比原始任务1结果 (批次边界Bug期) ===');
    const task1Results = await Result.find({
        task_id: 'hwc-pos-20251213-ykt',
        period: { $in: [25091, 25141, 25142] }
    }).lean();

    for (const r of task1Results) {
        console.log(`原始任务1 期号${r.period}: combination_count=${r.combination_count}`);
    }

    await mongoose.disconnect();
}

verifyNewTaskResults().catch(e => { console.error(e); process.exit(1); });
