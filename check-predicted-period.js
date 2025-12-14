const mongoose = require('mongoose');

async function checkPredictedPeriod() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    // 1. 查找最新任务
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });

    console.log('=== 最新任务 ===');
    console.log('task_id:', task?.task_id);
    console.log('status:', task?.status);
    console.log('exclusion_details_status:', task?.exclusion_details_status);
    console.log('exclusion_details_periods:', task?.exclusion_details_periods);

    // 2. 查找该任务的推算期结果
    const predictedResults = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({
            task_id: task?.task_id,
            is_predicted: true
        })
        .project({
            result_id: 1,
            period: 1,
            is_predicted: 1,
            has_exclusion_details: 1,
            lightweight_only: 1,
            'exclusion_summary': 1,
            'positive_selection_details': 1,
            combination_count: 1
        })
        .toArray();

    console.log('\n=== 推算期结果 ===');
    console.log('推算期数量:', predictedResults.length);

    predictedResults.forEach(r => {
        console.log('\n期号:', r.period);
        console.log('  has_exclusion_details:', r.has_exclusion_details);
        console.log('  lightweight_only:', r.lightweight_only);
        console.log('  combination_count:', r.combination_count);
        console.log('  exclusion_summary keys:', Object.keys(r.exclusion_summary || {}));
    });

    // 3. 检查排除详情表中是否有该任务的推算期数据
    const predictedPeriods = predictedResults.map(r => r.period);
    const detailsCount = await db.collection('hit_dlt_exclusiondetails')
        .countDocuments({
            task_id: task?.task_id,
            period: { $in: predictedPeriods }
        });

    console.log('\n=== 排除详情检查 ===');
    console.log('推算期期号:', predictedPeriods.join(', '));
    console.log('排除详情记录数:', detailsCount);

    // 4. 检查任务进度
    console.log('\n=== 任务进度 ===');
    console.log('exclusion_details_progress:', JSON.stringify(task?.exclusion_details_progress, null, 2));

    await mongoose.disconnect();
}

checkPredictedPeriod().catch(e => console.error(e));
