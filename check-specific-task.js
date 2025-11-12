const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const db = mongoose.connection.db;

    // 查找特定任务的结果
    const result = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({task_id: 'hwc-pos-20251102-o86'});

    if (result && result.positive_selection_details) {
        const d = result.positive_selection_details;
        console.log('\n✅ 找到结果: 期号', result.period);
        console.log('  Step 1 基准:', d.step1_count, 'ID数:', d.step1_base_combination_ids?.length || 0);
        console.log('  Step 2-6 保留:', d.step2_retained_count, d.step3_retained_count, d.step4_retained_count, d.step5_retained_count, d.step6_retained_count);
        console.log('  最终保留:', d.final_retained_count);
    } else {
        console.log('\n❌ 未找到结果或无positive_selection_details');
    }

    // 查找排除详情
    const exclusions = await db.collection('hit_dlt_exclusiondetails')
        .find({task_id: 'hwc-pos-20251102-o86'})
        .toArray();

    console.log('\n📊 排除详情记录数:', exclusions.length);
    exclusions.forEach(exc => {
        console.log('  Step', exc.step, ':', exc.excluded_count, '个组合');
    });

    mongoose.disconnect();
});
