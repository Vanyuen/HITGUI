/**
 * 验证小范围测试任务结果
 */
const mongoose = require('mongoose');

async function verifySmallTest() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const resultSchema = new mongoose.Schema({}, { strict: false });
    const Result = mongoose.model('Result_SmallTest', resultSchema, 'hit_dlt_hwcpositivepredictiontaskresults');

    console.log('=== 验证小范围测试任务 (hwc-pos-20251213-uyv) ===\n');

    const results = await Result.find({ task_id: 'hwc-pos-20251213-uyv' })
        .sort({ period: 1 })
        .lean();

    console.log(`共 ${results.length} 期结果:\n`);

    for (const r of results) {
        const status = r.combination_count > 0 ? '✅' : '❌';
        console.log(`${status} 期号${r.period}: combination_count=${r.combination_count}`);
    }

    // 统计
    const zeroPeriods = results.filter(r => r.combination_count === 0);
    console.log(`\n0组合期数: ${zeroPeriods.length}/${results.length}`);
    if (zeroPeriods.length > 0) {
        console.log(`0组合期号: ${zeroPeriods.map(r => r.period).join(', ')}`);
    }

    await mongoose.disconnect();
}

verifySmallTest().catch(e => { console.error(e); process.exit(1); });
