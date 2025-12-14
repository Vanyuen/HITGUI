/**
 * 诊断25138期处理失败的原因
 */
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

async function diagnose() {
    // 连接MongoDB
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    await client.connect();
    const db = client.db('lottery');

    console.log('=== 诊断25138期处理失败原因 ===\n');

    // 1. 检查25138期基本信息
    console.log('1. 检查25138期基本信息');
    const d25138 = await db.collection('hit_dlts').findOne({ Issue: 25138 });
    console.log('   存在:', Boolean(d25138));
    console.log('   ID:', d25138?.ID);

    // 2. 检查上一期 (ID-1)
    console.log('\n2. 检查上一期 (ID-1)');
    const d25137 = await db.collection('hit_dlts').findOne({ ID: d25138.ID - 1 });
    console.log('   上一期Issue:', d25137?.Issue);
    console.log('   上一期ID:', d25137?.ID);

    // 3. 检查HWC缓存数据
    console.log('\n3. 检查HWC缓存数据');
    const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
        base_issue: d25137?.Issue?.toString(),
        target_issue: '25138'
    });
    console.log('   HWC数据存在:', Boolean(hwcData));
    if (hwcData?.hot_warm_cold_data) {
        const ratios = Object.keys(hwcData.hot_warm_cold_data);
        console.log('   热温冷比数量:', ratios.length);
        console.log('   示例比例 "3:1:1":', hwcData.hot_warm_cold_data['3:1:1']?.length, '个组合');
    }

    // 4. 检查遗漏值数据 (fallback用)
    console.log('\n4. 检查遗漏值数据');
    const missingData = await db.collection('hit_dlt_basictrendchart_redballmissing_histories').findOne({
        Issue: d25137?.Issue?.toString()
    });
    console.log('   遗漏值数据存在:', Boolean(missingData));

    // 5. 检查最新任务的正选条件
    console.log('\n5. 检查最新任务的正选条件');
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne({}, { sort: { created_at: -1 } });
    if (task?.positive_selection) {
        console.log('   热温冷比选择:');
        const hwcRatios = task.positive_selection.red_hot_warm_cold_ratios || [];
        for (const r of hwcRatios.slice(0, 3)) {
            const ratioStr = typeof r === 'object' ? `${r.hot}:${r.warm}:${r.cold}` : r;
            console.log('     -', ratioStr);

            // 检查这个比例在HWC数据中是否存在
            if (hwcData?.hot_warm_cold_data) {
                const count = hwcData.hot_warm_cold_data[ratioStr]?.length || 0;
                console.log('       -> HWC数据中有', count, '个组合');
            }
        }
        console.log('   区间比选择:', (task.positive_selection.zone_ratios || []).length, '种');
    }

    // 6. 检查25139期的结果作为对比
    console.log('\n6. 对比25139期 (正常) vs 25138期 (失败)');
    const r25139 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne({
        task_id: task?.task_id,
        period: 25139
    });
    const r25138 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne({
        task_id: task?.task_id,
        period: 25138
    });

    console.log('   25138期:');
    console.log('     combination_count:', r25138?.combination_count);
    console.log('     step1_count:', r25138?.positive_selection_details?.step1_count);
    console.log('     error:', r25138?.error || '无');

    console.log('   25139期:');
    console.log('     combination_count:', r25139?.combination_count);
    console.log('     step1_count:', r25139?.positive_selection_details?.step1_count);
    console.log('     error:', r25139?.error || '无');

    await client.close();
    await mongoose.disconnect();
}

diagnose().catch(console.error);
