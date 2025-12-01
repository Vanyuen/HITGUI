const mongoose = require('mongoose');

async function debugPeriodField() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 调试期号字段类型 ===\n');

    // 获取一条记录，检查period字段类型
    const sample = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({});

    console.log('示例记录的period字段:');
    console.log('  值:', sample.period);
    console.log('  类型:', typeof sample.period);

    // 使用正确的类型查询
    const badTaskId = 'hwc-pos-20251129-xge';
    const goodTaskId = 'hwc-pos-20251129-2ia';

    // 尝试两种查询方式
    const period = 25095;

    console.log('\n=== 不同查询方式测试 ===');

    // 数字查询
    const byNumber = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: badTaskId, period: period });
    console.log(`数字查询 (${period}):`, byNumber ? '找到' : '未找到');

    // 字符串查询
    const byString = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: badTaskId, period: String(period) });
    console.log(`字符串查询 ("${period}"):`, byString ? '找到' : '未找到');

    // 直接获取任务的所有结果
    console.log('\n=== 问题任务的所有期号 ===');
    const badResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: badTaskId })
        .sort({ period: 1 })
        .toArray();

    console.log('期号列表 (前10个):');
    badResults.slice(0, 10).forEach(r => {
        console.log(`  ${r.period} (type: ${typeof r.period}): combos=${r.red_combinations?.length}`);
    });

    console.log('\n期号列表 (最后5个):');
    badResults.slice(-5).forEach(r => {
        console.log(`  ${r.period} (type: ${typeof r.period}): combos=${r.red_combinations?.length}`);
    });

    console.log('\n=== 正常任务的部分期号 ===');
    const goodResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: goodTaskId })
        .sort({ period: 1 })
        .limit(10)
        .toArray();

    console.log('期号列表 (前10个):');
    goodResults.forEach(r => {
        console.log(`  ${r.period} (type: ${typeof r.period}): combos=${r.red_combinations?.length}`);
    });

    // 关键：找出两个任务共同的期号范围
    console.log('\n=== 查找两个任务的共同期号 ===');
    const badPeriods = badResults.map(r => r.period);
    const goodPeriods = (await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: goodTaskId })
        .toArray()).map(r => r.period);

    const common = badPeriods.filter(p => goodPeriods.includes(p));
    console.log('共同期号数量:', common.length);
    console.log('共同期号:', common.slice(0, 10).join(', '), '...');

    // 对比共同期号的结果
    if (common.length > 0) {
        console.log('\n=== 对比共同期号的结果 ===');
        for (const period of common.slice(0, 5)) {
            const bad = badResults.find(r => r.period === period);
            const good = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
                .findOne({ task_id: goodTaskId, period: period });

            console.log(`期号 ${period}:`);
            console.log(`  问题任务: combos=${bad?.red_combinations?.length}, step1=${bad?.positive_selection_details?.step1_count}`);
            console.log(`  正常任务: combos=${good?.red_combinations?.length}, step1=${good?.positive_selection_details?.step1_count}`);
        }
    }

    await mongoose.disconnect();
}

debugPeriodField().catch(console.error);
