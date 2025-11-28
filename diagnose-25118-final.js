const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .find({ task_id: 'hwc-pos-20251116-2il' })
        .sort({ period: 1 })
        .toArray();

    console.log(`共找到 ${results.length} 条结果\n`);
    console.log('期号\t\t组合数\t\tis_predicted\twinning_numbers');
    console.log('─'.repeat(70));

    results.forEach(r => {
        const label = r.is_predicted ? '(推算)' : '(已开奖)';
        const hasWinning = r.winning_numbers ? '✅' : '❌';
        console.log(`${r.period} ${label}\t${r.paired_combinations?.length || 0}\t\t${r.is_predicted}\t\t${hasWinning}`);
    });

    // 检查第一个结果
    const firstResult = results[0];
    console.log('\n🔍 第一个结果详情:');
    console.log(`  期号: ${firstResult.period}`);
    console.log(`  is_predicted: ${firstResult.is_predicted}`);
    console.log(`  组合数: ${firstResult.paired_combinations?.length || 0}`);

    // 检查数据库中25118期的开奖状态
    const issue25118 = await db.collection('hit_dlts').findOne({ Issue: parseInt(firstResult.period) });

    if (issue25118) {
        console.log(`\n✅ 数据库中存在 ${firstResult.period} 期的开奖数据`);
        const reds = [issue25118.Red_1, issue25118.Red_2, issue25118.Red_3, issue25118.Red_4, issue25118.Red_5];
        const blues = [issue25118.Blue_1, issue25118.Blue_2];
        console.log(`  红球: ${reds.join(',')}`);
        console.log(`  蓝球: ${blues.join(',')}`);
        console.log('');
        console.log('❌ 问题确认:');
        console.log(`  ${firstResult.period} 期已经开奖，但被标记为推算期`);
        console.log(`  组合数为0，说明没有为这一期生成有效数据`);
    } else {
        console.log(`\n❌ 数据库中不存在 ${firstResult.period} 期的开奖数据`);
    }

    // 检查任务配置
    const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({ task_id: 'hwc-pos-20251116-2il' });

    console.log('\n📋 任务配置的期号范围:');
    console.log(`  start: ${task.period_range.start}`);
    console.log(`  end: ${task.period_range.end}`);
    console.log(`  total: ${task.period_range.total}`);

    console.log('\n💡 根本原因分析:');
    console.log('─'.repeat(70));

    if (parseInt(firstResult.period) < parseInt(task.period_range.start)) {
        console.log(`❌ 第一个结果期号 ${firstResult.period} 小于任务起始期号 ${task.period_range.start}`);
        console.log('');
        console.log('可能原因:');
        console.log('  1. target_issues数组构建时，错误地包含了base_issue作为第一个元素');
        console.log('  2. 期号范围计算逻辑在"最近N期"模式下，多包含了一期');
        console.log('  3. processHwcPositiveTask函数中，循环target_issues时逻辑错误');
        console.log('');
        console.log('💡 解决方案方向:');
        console.log('  需要检查 processHwcPositiveTask 函数 (src/server/server.js)');
        console.log('  查找target_issues数组的构建和处理逻辑');
        console.log('  确保不将base_issue作为target_issue处理');
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
