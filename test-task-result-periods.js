/**
 * 测试任务结果中是否包含推算的下一期
 * 验证: 最近10期应返回11期结果（10期已开奖 + 1期推算）
 */

const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

// Schema定义
const dltSchema = new mongoose.Schema({
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number,
    Date: String
}, { collection: 'hit_dlts' });

const predictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    period_range: {
        start: Number,
        end: Number,
        total: Number
    },
    status: String,
    created_at: Date
}, { collection: 'hit_dlt_predictiontasks' });

const predictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    combination_count: Number,
    hit_analysis: Object
}, { collection: 'hit_dlt_predictiontaskresults' });

const DLT = mongoose.model('DLT_Test', dltSchema);
const PredictionTask = mongoose.model('PredictionTask_Test', predictionTaskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult_Test', predictionTaskResultSchema);

async function main() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ 已连接到数据库\n');

        // 获取最新期号
        const latestRecord = await DLT.findOne({}).sort({ Issue: -1 }).select('Issue').lean();
        const latestIssue = latestRecord.Issue;
        const nextIssue = latestIssue + 1;

        console.log(`📅 数据库最新已开奖期号: ${latestIssue}`);
        console.log(`🔮 推算的下一期: ${nextIssue}\n`);

        // 查找最近的任务
        const recentTasks = await PredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        if (recentTasks.length === 0) {
            console.log('❌ 没有找到任务记录');
            mongoose.disconnect();
            return;
        }

        console.log(`📊 找到 ${recentTasks.length} 个任务，分析最近的任务:\n`);

        for (const task of recentTasks) {
            console.log('='.repeat(80));
            console.log(`📋 任务ID: ${task.task_id}`);
            console.log(`📝 任务名称: ${task.task_name}`);
            console.log(`📅 期号范围: ${task.period_range.start} - ${task.period_range.end} (声称${task.period_range.total}期)`);
            console.log(`📊 状态: ${task.status}`);
            console.log(`🕒 创建时间: ${new Date(task.created_at).toLocaleString('zh-CN')}`);

            // 查询该任务的结果
            const results = await PredictionTaskResult.find({ task_id: task.task_id })
                .sort({ period: 1 })
                .select('period combination_count')
                .lean();

            console.log(`\n📊 任务结果统计:`);
            console.log(`  - 实际结果记录数: ${results.length}期`);
            console.log(`  - 期号范围: ${results.length > 0 ? `${results[0].period} ~ ${results[results.length - 1].period}` : '无'}`);

            if (results.length > 0) {
                const firstPeriod = results[0].period;
                const lastPeriod = results[results.length - 1].period;

                // 检查是否包含推算的下一期
                const hasNextIssue = results.some(r => r.period === nextIssue);
                const allIssuesBeforeNext = results.every(r => r.period <= latestIssue);

                console.log(`\n🔍 推算期检查:`);
                console.log(`  - 是否包含推算的下一期(${nextIssue}): ${hasNextIssue ? '✅ 是' : '❌ 否'}`);
                console.log(`  - 所有期号都 ≤ 最新已开奖期: ${allIssuesBeforeNext ? '✅ 是（无推算期）' : '❌ 否（有推算期）'}`);

                // 分析期号范围与任务声称的差异
                const declaredTotal = task.period_range.total;
                const actualTotal = results.length;
                const diff = actualTotal - declaredTotal;

                console.log(`\n📊 期数差异分析:`);
                console.log(`  - 任务声称总期数: ${declaredTotal}`);
                console.log(`  - 实际结果期数: ${actualTotal}`);
                console.log(`  - 差异: ${diff >= 0 ? '+' : ''}${diff}`);

                if (actualTotal < declaredTotal) {
                    console.log(`  ⚠️ 结果少于声称期数（可能任务未完成或处理失败）`);
                } else if (actualTotal === declaredTotal + 1 && hasNextIssue) {
                    console.log(`  ✅ 符合预期：包含1期推算期`);
                } else if (actualTotal === declaredTotal && !hasNextIssue) {
                    console.log(`  ⚠️ 不符合预期：缺少推算期`);
                }

                // 显示前5期和后5期
                console.log(`\n📝 期号列表（前5期 + 后5期）:`);
                results.slice(0, 5).forEach((r, idx) => {
                    const isPredicted = r.period === nextIssue;
                    console.log(`  [${idx + 1}] 期号: ${r.period}${isPredicted ? ' 🔮 (推算)' : ''}, 组合数: ${r.combination_count?.toLocaleString() || 0}`);
                });

                if (results.length > 10) {
                    console.log(`  ... (省略${results.length - 10}期)`);
                }

                results.slice(-5).forEach((r, idx) => {
                    const actualIdx = results.length - 5 + idx;
                    const isPredicted = r.period === nextIssue;
                    console.log(`  [${actualIdx + 1}] 期号: ${r.period}${isPredicted ? ' 🔮 (推算)' : ''}, 组合数: ${r.combination_count?.toLocaleString() || 0}`);
                });
            }

            console.log('\n');
        }

        mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

main();
