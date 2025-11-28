const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 验证修复效果...\n');

    // 1. 检查任务
    const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks').find({}).toArray();
    console.log(`📋 任务数量: ${tasks.length}`);

    if (tasks.length > 0) {
        const task = tasks[0];
        console.log(`\n📝 任务信息:`);
        console.log(`  ID: ${task._id}`);
        console.log(`  名称: ${task.task_name}`);
        console.log(`  期号范围: ${task.target_issues ? task.target_issues.length : 0} 期`);
        console.log(`  状态: ${task.status}`);
        console.log(`  总组合数: ${task.total_combinations || 0}`);
        console.log(`  总期数: ${task.total_periods || 0}`);

        // 2. 检查任务结果
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task._id.toString() })
            .sort({ target_issue: 1 })
            .toArray();

        console.log(`\n📊 任务结果详情 (共${results.length}期):\n`);
        console.log('期号\t\t组合数\t\tis_predicted\t开奖号码\t\t命中分析');
        console.log('─'.repeat(100));

        let openedWithData = 0;
        let openedWithZero = 0;
        let predictedWithData = 0;

        for (const result of results) {
            const issue = result.target_issue;
            const combCount = result.paired_combinations?.length || 0;
            const isPredicted = result.is_predicted || false;
            const hasWinning = result.winning_numbers ? '✅' : '❌';
            const hasHitAnalysis = result.hit_analysis && Object.keys(result.hit_analysis).length > 0 ? '✅' : '❌';

            console.log(`${issue}\t${isPredicted ? '(推算)' : '(已开奖)'}\t${combCount}\t\t${isPredicted}\t\t${hasWinning}\t\t${hasHitAnalysis}`);

            if (isPredicted) {
                if (combCount > 0) predictedWithData++;
            } else {
                if (combCount > 0) openedWithData++;
                else openedWithZero++;
            }
        }

        console.log('\n📈 统计结果:');
        console.log(`  ✅ 已开奖期有数据: ${openedWithData} 期`);
        console.log(`  ❌ 已开奖期数据为0: ${openedWithZero} 期`);
        console.log(`  ✅ 推算期有数据: ${predictedWithData} 期`);

        if (openedWithZero === 0 && openedWithData > 0) {
            console.log('\n🎉 修复成功！所有已开奖期号都有数据！');
        } else if (openedWithZero > 0) {
            console.log('\n⚠️ 仍有问题：部分已开奖期号数据为0');
        }

        // 3. 检查热温冷优化表查询
        console.log('\n🌡️ 验证热温冷优化表查询:');
        if (results.length >= 2) {
            const firstResult = results[0];
            const baseIssue = firstResult.base_issue || (parseInt(firstResult.target_issue) - 1).toString();
            const targetIssue = firstResult.target_issue;

            console.log(`  查询期号对: ${baseIssue} → ${targetIssue}`);

            const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({
                    base_issue: baseIssue,
                    target_issue: targetIssue
                });

            if (hwcData) {
                console.log(`  ✅ 找到热温冷优化数据`);
                console.log(`     total_combinations: ${hwcData.total_combinations}`);
                console.log(`     热温冷比种类数: ${hwcData.hot_warm_cold_data ? hwcData.hot_warm_cold_data.size : 0}`);
            } else {
                console.log(`  ❌ 未找到热温冷优化数据`);
            }
        }
    } else {
        console.log('⚠️ 没有找到任务，请在应用中创建新任务');
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 连接失败:', err);
    process.exit(1);
});
