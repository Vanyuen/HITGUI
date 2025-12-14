/**
 * 检查原始任务中25091和25141期的结果
 */
const mongoose = require('mongoose');

async function checkOriginalResults() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const resultSchema = new mongoose.Schema({}, { strict: false });
    const Result = mongoose.model('Result', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

    console.log('=== 检查原始任务结果 ===\n');

    // 检查任务1: hwc-pos-20251213-ykt 中的25091和25141
    const task1Issues = ['25091', '25141', '25142'];
    for (const issue of task1Issues) {
        const result = await Result.findOne({
            task_id: 'hwc-pos-20251213-ykt',
            period: parseInt(issue)
        }).lean();

        if (result) {
            console.log(`任务1 期号${issue}: combination_count=${result.combination_count}, step1_count=${result.step1_count || 'N/A'}`);
            console.log(`  red_combinations长度: ${result.red_combinations?.length || 0}`);
        } else {
            console.log(`任务1 期号${issue}: 未找到结果`);
        }
    }

    console.log('');

    // 检查任务2: hwc-pos-20251213-7pg 中的25141
    const result2 = await Result.findOne({
        task_id: 'hwc-pos-20251213-7pg',
        period: 25141
    }).lean();

    if (result2) {
        console.log(`任务2 期号25141: combination_count=${result2.combination_count}, step1_count=${result2.step1_count || 'N/A'}`);
        console.log(`  red_combinations长度: ${result2.red_combinations?.length || 0}`);
    } else {
        console.log(`任务2 期号25141: 未找到结果`);
    }

    await mongoose.disconnect();
}

checkOriginalResults().catch(e => { console.error(e); process.exit(1); });
