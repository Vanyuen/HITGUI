const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 检查任务所有结果的period字段\n');

    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251116-2il' })
        .sort({ _id: 1 })
        .toArray();

    console.log(`共找到 ${results.length} 条结果\n`);

    console.log('序号\tperiod\t\t组合数\t\tis_predicted\twinning_numbers');
    console.log('─'.repeat(80));

    results.forEach((r, i) => {
        const hasWinning = r.winning_numbers ? '有' : '无';
        console.log(`${i + 1}\t${r.period}\t\t${r.paired_combinations?.length || 0}\t\t${r.is_predicted}\t\t${hasWinning}`);
    });

    // 统计
    console.log('\n📊 统计:');
    console.log(`  总期数: ${results.length}`);
    console.log(`  推算期数: ${results.filter(r => r.is_predicted).length}`);
    console.log(`  已开奖期数: ${results.filter(r => !r.is_predicted).length}`);

    const periods = results.map(r => r.period).filter(p => p);
    console.log(`\n📋 所有期号: ${periods.join(', ')}`);

    if (periods.length > 0) {
        const min = Math.min(...periods.map(p => parseInt(p)));
        const max = Math.max(...periods.map(p => parseInt(p)));
        console.log(`  期号范围: ${min} - ${max}`);
    }

    // 检查第一个结果
    if (results.length > 0) {
        const first = results[0];
        console.log(`\n🔍 第一个结果详情:`);
        console.log(`  period: ${first.period}`);
        console.log(`  is_predicted: ${first.is_predicted}`);
        console.log(`  组合数: ${first.paired_combinations?.length || 0}`);

        if (first.winning_numbers) {
            console.log(`  开奖号码: 红球=${first.winning_numbers.red || '无'}, 蓝球=${first.winning_numbers.blue || '无'}`);
        } else {
            console.log(`  开奖号码: 无`);
        }
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
