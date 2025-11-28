/**
 * 诊断热温冷正选任务的内存问题
 */

const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = mongoose.connection.db;

        console.log('=== 内存问题诊断 ===\n');

        // 检查最新任务
        const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { created_at: -1 } });

        if (!latestTask) {
            console.log('未找到任务');
            mongoose.connection.close();
            return;
        }

        console.log('任务ID:', latestTask.task_id);
        console.log('任务名称:', latestTask.task_name);
        console.log('创建时间:', latestTask.created_at);
        console.log('期号范围:', latestTask.period_range);
        console.log('\n正选条件:');
        console.log('  热温冷比:', latestTask.positive_selection?.red_hot_warm_cold_ratios || latestTask.positive_selection?.hwc_ratios || '未定义');
        console.log('  区间比:', latestTask.positive_selection?.zone_ratios || '未定义');
        console.log('  和值范围:', latestTask.positive_selection?.sum_ranges || '未定义');

        // 检查期号数量
        const startIssue = latestTask.period_range?.start;
        const endIssue = latestTask.period_range?.end;

        if (startIssue && endIssue) {
            const issueCount = await db.collection('hit_dlts')
                .countDocuments({
                    Issue: { $gte: parseInt(startIssue), $lte: parseInt(endIssue) }
                });

            console.log('\n期号统计:');
            console.log('  起始期号:', startIssue);
            console.log('  结束期号:', endIssue);
            console.log('  实际期号数:', issueCount);

            // 🚨 警告：如果期号数过多
            if (issueCount > 100) {
                console.log('\n⚠️  警告: 期号数量过多 (' + issueCount + ' 期)');
                console.log('   这可能导致内存溢出！');
                console.log('   建议: 限制期号范围在100期以内');
            }
        }

        // 检查任务结果
        const resultCount = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .countDocuments({ task_id: latestTask.task_id });

        console.log('\n任务结果:');
        console.log('  结果记录数:', resultCount);

        // 检查红球组合数
        const redCombCount = await db.collection('hit_dlt_redcombinations').countDocuments({});
        console.log('\n数据库统计:');
        console.log('  红球组合总数:', redCombCount.toLocaleString());

        // 估算内存使用
        const estimatedMemoryMB = issueCount * 0.5; // 粗略估算：每期0.5MB
        console.log('\n内存估算:');
        console.log('  预计内存消耗:', estimatedMemoryMB.toFixed(2), 'MB');

        if (estimatedMemoryMB > 1500) {
            console.log('  ⚠️  内存消耗可能超过限制！');
        }

        console.log('\n=== 诊断完成 ===');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

diagnose();
