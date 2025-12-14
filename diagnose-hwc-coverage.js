const mongoose = require('mongoose');

async function diagnose() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const tasks = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');

    // 获取成功和失败的任务
    const successTask = await tasks.findOne({ task_id: 'hwc-pos-20251202-jf7' });
    const failTask = await tasks.findOne({ task_id: 'hwc-pos-20251202-tte' });

    console.log('=== 成功任务 (jf7) 配置 ===');
    console.log('期号范围:', JSON.stringify(successTask?.period_range));
    console.log('正选条件 红热温冷比:', successTask?.positive_selection?.red_hot_warm_cold_ratios?.length || 0, '种');

    console.log('\n=== 失败任务 (tte) 配置 ===');
    console.log('期号范围:', JSON.stringify(failTask?.period_range));
    console.log('正选条件 红热温冷比:', failTask?.positive_selection?.red_hot_warm_cold_ratios?.length || 0, '种');

    // 检查 HWC 优化表的数据覆盖范围
    const hwcTable = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 检查最小的 target_issue
    const allIssues = await hwcTable.distinct('target_issue');
    const numericIssues = allIssues.map(i => parseInt(i)).filter(i => !isNaN(i)).sort((a, b) => a - b);

    console.log('\n=== HWC表数据范围 ===');
    console.log('最小期号:', numericIssues[0]);
    console.log('最大期号:', numericIssues[numericIssues.length - 1]);

    // 检查 25025 是否在 HWC 表中
    const check25025 = await hwcTable.findOne({ target_issue: '25025' });
    console.log('\n期号 25025 是否有数据:', check25025 ? '是' : '否');

    // 检查 25075 是否在 HWC 表中
    const check25075 = await hwcTable.findOne({ target_issue: '25075' });
    console.log('期号 25075 是否有数据:', check25075 ? '是' : '否');

    // 找出没有 HWC 数据的期号范围
    const dlts = mongoose.connection.collection('hit_dlts');
    const allDltIssues = await dlts.distinct('Issue');
    const dltNumeric = allDltIssues.sort((a, b) => a - b);

    console.log('\n=== DLT 历史数据范围 ===');
    console.log('最小期号:', dltNumeric[0]);
    console.log('最大期号:', dltNumeric[dltNumeric.length - 1]);
    console.log('总期数:', dltNumeric.length);

    // 比较 HWC 和 DLT 的覆盖范围
    console.log('\n=== 覆盖比较 ===');
    console.log('HWC 覆盖期数:', numericIssues.length);
    console.log('DLT 总期数:', dltNumeric.length);

    // 找出最近100期中哪些缺少 HWC 数据
    const recent100 = dltNumeric.slice(-100);
    const hwcSet = new Set(numericIssues);
    const missingInHwc = recent100.filter(i => !hwcSet.has(i));
    console.log('\n最近100期中缺少 HWC 数据的期号:', missingInHwc.length > 0 ? missingInHwc.join(', ') : '无');

    await mongoose.disconnect();
}

diagnose().catch(e => console.error(e));
