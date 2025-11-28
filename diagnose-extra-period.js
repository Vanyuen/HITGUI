const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const db = mongoose.connection.db;

    console.log('🔍 诊断多一期推算期问题\n');

    // 1. 检查25118和25119的开奖状态
    console.log('📊 步骤1: 检查数据库中的开奖数据');
    console.log('─'.repeat(60));

    const issues = await db.collection('hit_dlts').find({
        Issue: { $in: [25116, 25117, 25118, 25119, 25120, 25121] }
    }).sort({ Issue: 1 }).toArray();

    console.log('期号\t\t红球\t\t\t\t蓝球\t开奖状态');
    for (const issue of issues) {
        const reds = [issue.Red_1, issue.Red_2, issue.Red_3, issue.Red_4, issue.Red_5];
        const blues = [issue.Blue_1, issue.Blue_2];
        console.log(`${issue.Issue}\t\t${reds.join(',')}\t\t${blues.join(',')}\t✅ 已开奖`);
    }

    const latestIssue = issues[issues.length - 1]?.Issue || 0;
    console.log(`\n最新已开奖期号: ${latestIssue}`);
    console.log(`下一期（推算）: ${latestIssue + 1}`);

    // 2. 检查最新的热温冷正选任务
    console.log('\n📋 步骤2: 检查最新任务的期号范围');
    console.log('─'.repeat(60));

    const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
        .find({})
        .sort({ created_at: -1 })
        .limit(1)
        .toArray();

    if (latestTask.length > 0) {
        const task = latestTask[0];
        console.log(`任务ID: ${task._id}`);
        console.log(`任务名称: ${task.task_name}`);
        console.log(`起始期号: ${task.start_issue}`);
        console.log(`结束期号: ${task.end_issue}`);
        console.log(`总期数: ${task.total_periods || 0}`);

        // 3. 检查任务结果
        console.log('\n📊 步骤3: 检查任务结果详情');
        console.log('─'.repeat(60));

        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task._id.toString() })
            .sort({ target_issue: 1 })
            .toArray();

        if (results.length === 0) {
            console.log('⚠️ 任务没有结果数据');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('期号\t\t组合数\tis_predicted\t有开奖号码');
        console.log('─'.repeat(60));

        for (const result of results) {
            const hasWinning = result.winning_numbers ? '✅' : '❌';
            const label = result.is_predicted ? '(推算)' : '(已开奖)';
            console.log(`${result.target_issue} ${label}\t${result.paired_combinations?.length || 0}\t${result.is_predicted}\t\t${hasWinning}`);
        }

        // 4. 分析问题
        console.log('\n🔍 步骤4: 问题分析');
        console.log('─'.repeat(60));

        const firstResult = results[0];
        const firstIssue = parseInt(firstResult.target_issue);

        if (firstResult.is_predicted && firstResult.paired_combinations?.length === 0) {
            console.log(`⚠️ 发现问题: ${firstResult.target_issue} 被标记为推算期且组合数为0`);

            // 检查数据库中是否有此期号
            const issueInDb = await db.collection('hit_dlts').findOne({ Issue: firstIssue });

            if (issueInDb) {
                console.log(`✅ 数据库中存在 ${firstIssue} 期的开奖数据`);
                console.log(`   红球: ${[issueInDb.Red_1, issueInDb.Red_2, issueInDb.Red_3, issueInDb.Red_4, issueInDb.Red_5].join(',')}`);
                console.log(`   蓝球: ${[issueInDb.Blue_1, issueInDb.Blue_2].join(',')}`);
                console.log('');
                console.log('❌ 根本原因: 期号范围计算包含了一期不应该包含的期号');
                console.log('   期号已开奖但被错误标记为推算期，且没有生成组合数据');
            } else {
                console.log(`❌ 数据库中不存在 ${firstIssue} 期的开奖数据`);
                console.log('');
                console.log('❌ 根本原因: 期号范围计算多包含了一期未开奖的期号');
            }

            // 5. 检查热温冷优化表
            console.log('\n🌡️ 步骤5: 检查热温冷优化表');
            console.log('─'.repeat(60));

            const baseIssue = (firstIssue - 1).toString();
            const targetIssue = firstIssue.toString();

            const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .findOne({
                    base_issue: baseIssue,
                    target_issue: targetIssue
                });

            if (hwcData) {
                console.log(`✅ 找到 ${baseIssue}→${targetIssue} 的热温冷优化数据`);
                console.log(`   total_combinations: ${hwcData.total_combinations}`);
            } else {
                console.log(`❌ 未找到 ${baseIssue}→${targetIssue} 的热温冷优化数据`);
                console.log('   这也可能导致组合数为0');
            }
        }

        // 6. 推荐解决方案
        console.log('\n💡 解决方案建议');
        console.log('─'.repeat(60));

        console.log('方案A: 过滤掉组合数为0的推算期');
        console.log('  优点: 简单直接，立即见效');
        console.log('  缺点: 治标不治本，不解决根本原因');
        console.log('  实施位置: 前端显示逻辑或后端结果返回逻辑');

        console.log('\n方案B: 修复期号范围计算逻辑');
        console.log('  优点: 根本解决问题，避免生成错误数据');
        console.log('  缺点: 需要深入排查期号范围计算逻辑');
        console.log('  实施位置: 任务创建时的期号范围解析逻辑');

        console.log('\n方案C: 修复热温冷数据查询逻辑');
        console.log('  优点: 确保所有期号都能查到组合数据');
        console.log('  缺点: 如果优化表本身缺数据，需要重新生成');
        console.log('  实施位置: 热温冷正选任务处理逻辑');

    } else {
        console.log('⚠️ 没有找到任务');
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 连接失败:', err);
    process.exit(1);
});
