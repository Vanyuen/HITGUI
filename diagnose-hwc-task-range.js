const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function diagnoseHwcTask() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🕵️ 热温冷正选任务诊断脚本\n');

    try {
        // 查找最新的热温冷正选任务
        const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { created_at: -1 } });

        if (!task) {
            console.log('❌ 未找到任何热温冷正选任务');
            return;
        }

        console.log('📋 最新任务配置:');
        console.log(`  任务ID: ${task.task_id}`);
        console.log(`  创建时间: ${task.created_at}`);
        console.log(`  期号范围配置:`);
        console.log(`    类型: ${task.period_range.type}`);
        console.log(`    起始期号: ${task.period_range.start}`);
        console.log(`    结束期号: ${task.period_range.end}`);
        console.log(`    总期数: ${task.period_range.total}`);
        console.log(`    预测期数: ${task.period_range.predicted_count || 0}`);

        // 查询该任务的所有结果
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .sort({ period: 1 })
            .toArray();

        console.log('\n📊 任务结果详情:');
        console.log('期号\t\t组合数\t\tis_predicted\t开奖号码');
        console.log('─'.repeat(70));

        results.forEach(result => {
            const hasWinningNumbers = result.winning_numbers ? '✅' : '❌';
            console.log(
                `${result.period}\t\t${result.paired_combinations?.length || 0}\t\t` +
                `${result.is_predicted}\t\t${hasWinningNumbers}`
            );
        });

        // 分析期号范围生成逻辑
        console.log('\n🔍 期号范围解析分析:');
        const distinctPeriods = [...new Set(results.map(r => r.period))].sort();
        console.log(`  首个期号: ${distinctPeriods[0]}`);
        console.log(`  最后期号: ${distinctPeriods[distinctPeriods.length - 1]}`);
        console.log(`  总期数: ${distinctPeriods.length}`);

        // 检查期号范围与配置是否一致
        if (parseInt(distinctPeriods[0]) < parseInt(task.period_range.start) ||
            parseInt(distinctPeriods[distinctPeriods.length - 1]) > parseInt(task.period_range.end)) {
            console.log('\n❌ 警告: 期号范围与任务配置不一致');
        }

        // 检查processHwcPositiveTask函数的源码
        const serverJsPath = path.join(__dirname, 'src', 'server', 'server.js');
        if (fs.existsSync(serverJsPath)) {
            const serverJs = fs.readFileSync(serverJsPath, 'utf-8');
            const processTaskFuncMatch = serverJs.match(/async function processHwcPositiveTask\(taskId\)\s*{[\s\S]*?resolveIssueRangeInternal\(\{[\s\S]*?rangeType:\s*'([^']+)'[\s\S]*?\}\)/);

            if (processTaskFuncMatch) {
                console.log(`\n💡 最后一次调用resolveIssueRangeInternal的模式: ${processTaskFuncMatch[1]}`);
            }
        }

    } catch (error) {
        console.error('❌ 诊断过程中发生错误:', error);
    } finally {
        await mongoose.connection.close();
    }
}

diagnoseHwcTask().catch(console.error);