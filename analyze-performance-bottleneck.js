/**
 * 分析热温冷正选任务的性能瓶颈
 */

const mongoose = require('mongoose');

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    combination_count: Number,
    red_combinations: [Number],
    positive_selection_details: Object,
    exclusion_summary: Object,
    created_at: Date
});

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function analyze() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('=== 性能瓶颈分析 ===\n');

        // 查找最新任务的所有结果
        const latestResult = await HwcPositivePredictionTaskResult
            .findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestResult) {
            console.log('没有找到任务结果');
            mongoose.connection.close();
            return;
        }

        const taskId = latestResult.task_id;
        console.log('任务ID:', taskId);
        console.log('');

        // 获取所有期号结果并计算时间差
        const results = await HwcPositivePredictionTaskResult
            .find({ task_id: taskId })
            .sort({ period: 1 })
            .select('period combination_count positive_selection_details exclusion_summary created_at')
            .lean();

        console.log(`找到 ${results.length} 个期号结果\n`);
        console.log('=== 各期号处理时间分析 ===\n');

        let totalTime = 0;
        let prevTime = null;

        results.forEach((result, index) => {
            const currentTime = new Date(result.created_at).getTime();

            if (prevTime) {
                const timeDiff = (currentTime - prevTime) / 1000; // 转换为秒
                totalTime += timeDiff;

                const comboCount = result.combination_count || 0;
                const details = result.positive_selection_details || {};
                const step1 = details.step1_count || 0;
                const step2 = details.step2_retained_count || 0;
                const final = details.final_retained_count || 0;

                console.log(`期号 ${result.period}:`);
                console.log(`  处理时间: ${timeDiff.toFixed(2)}秒`);
                console.log(`  组合数: ${comboCount.toLocaleString()}`);
                console.log(`  Step1: ${step1.toLocaleString()} → Step2: ${step2.toLocaleString()} → Final: ${final.toLocaleString()}`);

                if (timeDiff > 10) {
                    console.log(`  ⚠️  处理时间过长!`);
                }
                console.log('');
            }

            prevTime = currentTime;
        });

        console.log('=== 总体统计 ===');
        console.log(`总处理时间: ${totalTime.toFixed(2)}秒`);
        console.log(`平均每期: ${(totalTime / (results.length - 1)).toFixed(2)}秒`);
        console.log('');

        // 分析可能的瓶颈
        console.log('=== 瓶颈分析 ===\n');

        const hasExclusionSummary = results.filter(r => r.exclusion_summary).length;
        const hasPositiveDetails = results.filter(r => r.positive_selection_details).length;

        console.log('1. 数据完整性:');
        console.log(`   - 有排除摘要的期号: ${hasExclusionSummary}/${results.length}`);
        console.log(`   - 有正选详情的期号: ${hasPositiveDetails}/${results.length}`);
        console.log('');

        console.log('2. 可能的性能瓶颈:');
        if (totalTime / (results.length - 1) > 5) {
            console.log('   ⚠️  平均处理时间过长 (>5秒/期)');
            console.log('   可能原因:');
            console.log('   - 命中分析计算过慢 (需要查询开奖数据)');
            console.log('   - 排除条件处理过慢');
            console.log('   - 数据库写入慢');
            console.log('   - 排除详情保存过多数据');
        }

        // 检查排除详情的数据量
        const sampleResult = results.find(r => r.exclusion_summary);
        if (sampleResult && sampleResult.exclusion_summary) {
            const summary = sampleResult.exclusion_summary;
            console.log('');
            console.log('3. 排除详情数据量分析 (样本):');
            console.log(`   - 初始组合: ${summary.initial_count || 'N/A'}`);
            console.log(`   - 保留组合: ${summary.retained_count || 'N/A'}`);
            console.log(`   - 排除总数: ${summary.total_excluded || 'N/A'}`);

            if (summary.total_excluded > 100000) {
                console.log('   ⚠️  排除数据量很大，可能导致保存慢');
            }
        }

        console.log('\n=== 分析完成 ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

analyze();
