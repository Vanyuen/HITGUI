const mongoose = require('mongoose');

async function investigate() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 1. 检查两个任务的Step2排除详情
    console.log('=== 检查Step2排除详情记录 ===\n');

    const tkaStep2 = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .find({
            task_id: 'hwc-pos-20251209-tka',
            condition: 'positive_step2_zone_ratio'
        }).toArray();

    const vw8Step2 = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .find({
            task_id: 'hwc-pos-20251209-vw8',
            condition: 'positive_step2_zone_ratio'
        }).toArray();

    console.log('tka Step2记录数:', tkaStep2.length);
    tkaStep2.forEach(r => console.log(`  - period: ${r.period}, excluded_count: ${r.excluded_count}`));

    console.log('\nvw8 Step2记录数:', vw8Step2.length);
    vw8Step2.forEach(r => console.log(`  - period: ${r.period}, excluded_count: ${r.excluded_count}`));

    // 2. 检查两个任务的所有排除详情按step统计
    console.log('\n=== 所有排除详情按step统计 ===');

    const tkaAll = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .aggregate([
            { $match: { task_id: 'hwc-pos-20251209-tka' } },
            { $group: { _id: '$step', count: { $sum: 1 }, conditions: { $addToSet: '$condition' } } },
            { $sort: { _id: 1 } }
        ]).toArray();

    const vw8All = await mongoose.connection.db.collection('hit_dlt_exclusiondetails')
        .aggregate([
            { $match: { task_id: 'hwc-pos-20251209-vw8' } },
            { $group: { _id: '$step', count: { $sum: 1 }, conditions: { $addToSet: '$condition' } } },
            { $sort: { _id: 1 } }
        ]).toArray();

    console.log('\ntka 各Step记录数:');
    tkaAll.forEach(r => console.log(`  Step ${r._id}: ${r.count}条 - ${r.conditions.join(', ')}`));

    console.log('\nvw8 各Step记录数:');
    vw8All.forEach(r => console.log(`  Step ${r._id}: ${r.count}条 - ${r.conditions.join(', ')}`));

    // 3. 检查结果中的positive_selection_details
    console.log('\n=== 检查结果中的positive_selection_details (25141期) ===');

    const tkaResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-tka', target_issue: '25141' });

    const vw8Result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-vw8', target_issue: '25141' });

    if (tkaResult) {
        console.log('\ntka 25141期 positive_selection_details:');
        if (tkaResult.positive_selection_details) {
            Object.entries(tkaResult.positive_selection_details).forEach(([k, v]) => {
                console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
            });
        } else {
            console.log('  (无数据)');
        }
    } else {
        console.log('\ntka 25141期: 找不到结果');
    }

    if (vw8Result) {
        console.log('\nvw8 25141期 positive_selection_details:');
        if (vw8Result.positive_selection_details) {
            Object.entries(vw8Result.positive_selection_details).forEach(([k, v]) => {
                console.log(`  ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
            });
        } else {
            console.log('  (无数据)');
        }
    } else {
        console.log('\nvw8 25141期: 找不到结果');
    }

    // 4. 检查任务配置
    console.log('\n=== 任务配置对比 ===');

    const tkaTask = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251209-tka' });

    const vw8Task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251209-vw8' });

    console.log('\ntka output_config.exclusion_details:');
    console.log(JSON.stringify(tkaTask.output_config.exclusion_details, null, 2));

    console.log('\nvw8 output_config.exclusion_details:');
    console.log(JSON.stringify(vw8Task.output_config.exclusion_details, null, 2));

    // 5. 对比任务创建时间
    console.log('\n=== 任务创建时间 ===');
    console.log('tka created_at:', tkaTask.created_at);
    console.log('vw8 created_at:', vw8Task.created_at);

    await mongoose.disconnect();
}

investigate().catch(console.error);
