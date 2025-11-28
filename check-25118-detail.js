const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 检查任务结果中25118期的详细信息\n');

    const result25118 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({
            task_id: 'hwc-pos-20251116-2il',
            period: '25118'
        });

    if (result25118) {
        console.log('✅ 找到25118期的结果');
        console.log(`  期号: ${result25118.period}`);
        console.log(`  is_predicted: ${result25118.is_predicted}`);
        console.log(`  组合数: ${result25118.paired_combinations?.length || 0}`);
        console.log(`  winning_numbers: ${JSON.stringify(result25118.winning_numbers)}`);
        console.log(`  hit_analysis: ${JSON.stringify(result25118.hit_analysis)}`);

        if (result25118.winning_numbers) {
            console.log('\n📊 结论: 25118期有开奖号码');
            console.log(`  红球: ${result25118.winning_numbers.red || 'N/A'}`);
            console.log(`  蓝球: ${result25118.winning_numbers.blue || 'N/A'}`);
        } else {
            console.log('\n❌ 结论: 25118期没有开奖号码（未开奖或查询失败）');
        }

        console.log('\n🔍 问题分析:');
        if (result25118.is_predicted && result25118.winning_numbers) {
            console.log('  ⚠️ 矛盾: is_predicted=true 但有开奖号码');
            console.log('  可能原因: is_predicted字段判断错误');
        } else if (result25118.is_predicted && !result25118.winning_numbers) {
            console.log('  ✅ 一致: is_predicted=true 且无开奖号码');
            console.log('  符合推算期的特征');
        }
    } else {
        console.log('❌ 未找到25118期的结果');
    }

    // 检查25119期对比
    const result25119 = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({
            task_id: 'hwc-pos-20251116-2il',
            period: '25119'
        });

    if (result25119) {
        console.log('\n✅ 找到25119期的结果（对比）');
        console.log(`  期号: ${result25119.period}`);
        console.log(`  is_predicted: ${result25119.is_predicted}`);
        console.log(`  组合数: ${result25119.paired_combinations?.length || 0}`);
        console.log(`  winning_numbers: ${result25119.winning_numbers ? '有' : '无'}`);
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
});
