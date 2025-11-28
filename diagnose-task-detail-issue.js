/**
 * 诊断任务详情面板数据错误问题
 */

const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('=== 诊断开始 ===\n');

        const db = mongoose.connection.db;

        // 1. 查询hit_dlts表,确认最新期号
        console.log('1. 检查 hit_dlts 表最新期号:');
        const latestIssue = await db.collection('hit_dlts').findOne({}, { sort: { Issue: -1 } });
        console.log(`   最新已开奖期号: ${latestIssue ? latestIssue.Issue : '未找到'}`);
        console.log(`   最新期号ID: ${latestIssue ? latestIssue.ID : '未找到'}\n`);

        // 2. 检查25114是否存在
        console.log('2. 检查期号25114是否存在:');
        const issue25114 = await db.collection('hit_dlts').findOne({ Issue: 25114 });
        if (issue25114) {
            console.log(`   ✅ 期号25114已开奖`);
            console.log(`   开奖数据: 红球=[${issue25114.Red1}, ${issue25114.Red2}, ${issue25114.Red3}, ${issue25114.Red4}, ${issue25114.Red5}], 蓝球=[${issue25114.Blue1}, ${issue25114.Blue2}]\n`);
        } else {
            console.log(`   ❌ 期号25114不存在（未开奖）\n`);
        }

        // 3. 查询最新任务
        console.log('3. 查询最新的热温冷正选任务:');
        const latestTask = await db.collection('hwcpositivepredictiontasks').findOne(
            {},
            { sort: { created_at: -1 } }
        );

        if (!latestTask) {
            console.log('   未找到任务\n');
            mongoose.connection.close();
            return;
        }

        console.log(`   任务ID: ${latestTask.task_id}`);
        console.log(`   任务名称: ${latestTask.task_name}`);
        console.log(`   期号范围: ${latestTask.period_range.start} - ${latestTask.period_range.end}`);
        console.log(`   总期数: ${latestTask.period_range.total}`);
        console.log(`   推算期数: ${latestTask.period_range.predicted_count || 0}\n`);

        // 4. 查询该任务的所有结果
        console.log('4. 查询该任务的所有期号结果:');
        const results = await db.collection('hwcpositivepredictiontaskresults')
            .find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .toArray();

        console.log(`   共 ${results.length} 期结果\n`);

        // 5. 检查每一期的is_predicted标记
        console.log('5. 检查每一期的is_predicted标记:');
        for (const result of results) {
            const isPredicted = result.is_predicted;
            const hasCombos = result.combination_count > 0;
            const hasHitAnalysis = result.hit_analysis && Object.keys(result.hit_analysis).length > 0;

            // 在数据库中验证该期号是否真的开奖了
            const issueData = await db.collection('hit_dlts').findOne({ Issue: result.period });
            const actuallyExists = !!issueData;

            const statusIcon = isPredicted ? '🔮' : '✅';
            const errorFlag = (isPredicted && actuallyExists) ? ' ⚠️【错误:已开奖却标记为推算】' :
                              (!isPredicted && !actuallyExists) ? ' ⚠️【错误:未开奖却未标记推算】' : '';

            console.log(`   ${statusIcon} 期号${result.period}: is_predicted=${isPredicted}, 组合数=${result.combination_count}, 有命中分析=${hasHitAnalysis}, 实际是否开奖=${actuallyExists}${errorFlag}`);
        }

        console.log('\n=== 诊断完成 ===');
        mongoose.connection.close();

    } catch (error) {
        console.error('诊断失败:', error.message);
        process.exit(1);
    }
}

diagnose();
