/**
 * 诊断最新的热温冷正选任务 - 详细版本
 */

const mongoose = require('mongoose');

// Schema定义
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    task_type: String,
    period_range: Object,
    positive_selection: Object,
    exclusion_conditions: Object,
    output_config: Object,
    status: String,
    progress: Object,
    statistics: Object,
    created_at: Date,
    updated_at: Date,
    completed_at: Date
});

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    combination_count: Number,
    red_combinations: [Number],
    blue_combinations: [Number],
    paired_combinations: [{ red_combo_id: Number, blue_combo_id: Number }],
    pairing_mode: String,
    is_predicted: Boolean,
    hit_analysis: Object,
    exclusion_summary: Object,
    positive_selection_details: Object,
    winning_numbers: Object,
    created_at: Date
});

const HwcPositivePredictionTask = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTask',
    hwcPositivePredictionTaskSchema,
    'hit_dlt_hwcpositivepredictiontasks'
);

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('=== 诊断最新热温冷正选任务 ===\n');

        // 1. 查找最新的任务
        const latestTask = await HwcPositivePredictionTask
            .findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 数据库中没有任何热温冷正选任务');
            mongoose.connection.close();
            return;
        }

        console.log('📋 最新任务信息:');
        console.log('  - 任务ID:', latestTask.task_id);
        console.log('  - 任务名称:', latestTask.task_name);
        console.log('  - 创建时间:', latestTask.created_at);
        console.log('  - 状态:', latestTask.status);
        console.log('');

        // 2. 显示正选条件
        console.log('✨ 正选条件 (positive_selection):');
        if (latestTask.positive_selection) {
            console.log(JSON.stringify(latestTask.positive_selection, null, 2));
        } else {
            console.log('  ❌ 没有正选条件');
        }
        console.log('');

        // 3. 显示期号范围
        console.log('📅 期号范围 (period_range):');
        if (latestTask.period_range) {
            console.log(JSON.stringify(latestTask.period_range, null, 2));
        }
        console.log('');

        // 4. 查询该任务的所有结果
        const results = await HwcPositivePredictionTaskResult
            .find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .lean();

        console.log(`📊 任务包含 ${results.length} 个期号结果\n`);

        // 5. 详细分析每个期号
        console.log('=== 详细期号分析 ===\n');

        for (const result of results) {
            const isPredicted = result.is_predicted || false;
            const savedCount = result.combination_count || 0;
            const redCount = result.red_combinations ? result.red_combinations.length : 0;
            const blueCount = result.blue_combinations ? result.blue_combinations.length : 0;
            const pairedCount = result.paired_combinations ? result.paired_combinations.length : 0;

            console.log(`${isPredicted ? '🔮' : '📍'} 期号 ${result.period}${isPredicted ? ' (推算)' : ''}:`);
            console.log(`   组合数: ${savedCount.toLocaleString()}`);
            console.log(`   红球数: ${redCount.toLocaleString()}, 蓝球数: ${blueCount}, 配对数: ${pairedCount.toLocaleString()}`);

            // 显示正选详情
            if (result.positive_selection_details) {
                console.log('   ✨ 正选详情:', JSON.stringify(result.positive_selection_details));
            } else {
                console.log('   ⚠️  缺少正选详情 (positive_selection_details)');
            }

            // 显示排除摘要
            if (result.exclusion_summary) {
                const summary = result.exclusion_summary;
                console.log('   🚫 排除摘要:');
                console.log(`      - 初始组合: ${summary.initial_count || 'N/A'}`);
                console.log(`      - 保留组合: ${summary.retained_count || 'N/A'}`);
                console.log(`      - 排除总数: ${summary.total_excluded || 'N/A'}`);

                if (summary.by_condition) {
                    console.log('      - 各条件排除:');
                    for (const [condition, count] of Object.entries(summary.by_condition)) {
                        console.log(`        • ${condition}: ${count}`);
                    }
                }
            } else {
                console.log('   ⚠️  缺少排除摘要 (exclusion_summary)');
            }

            console.log('');
        }

        // 6. 统计汇总
        const nonZeroCount = results.filter(r => (r.combination_count || 0) > 0).length;
        const zeroCount = results.filter(r => (r.combination_count || 0) === 0).length;
        const predictedCount = results.filter(r => r.is_predicted).length;

        console.log('=== 统计汇总 ===');
        console.log(`总期号数: ${results.length}`);
        console.log(`组合数>0: ${nonZeroCount} 个`);
        console.log(`组合数=0: ${zeroCount} 个`);
        console.log(`推算期号: ${predictedCount} 个`);
        console.log('');

        // 7. 问题分析
        if (zeroCount > 0) {
            console.log('=== 问题诊断 ===');
            console.log('');
            console.log('🔍 发现以下异常:');

            const zeroResults = results.filter(r => (r.combination_count || 0) === 0);
            const hasRedCombos = zeroResults.filter(r => r.red_combinations && r.red_combinations.length > 0);
            const noRedCombos = zeroResults.filter(r => !r.red_combinations || r.red_combinations.length === 0);

            console.log(`  1. 组合数为0但有红球数据: ${hasRedCombos.length} 个`);
            if (hasRedCombos.length > 0) {
                console.log('     期号:', hasRedCombos.map(r => r.period).join(', '));
                console.log('     ⚠️  这是BUG! combination_count应该等于red_combinations.length');
            }

            console.log(`  2. 组合数为0且无红球数据: ${noRedCombos.length} 个`);
            if (noRedCombos.length > 0) {
                console.log('     期号:', noRedCombos.map(r => r.period).join(', '));
                console.log('     ⚠️  正选条件可能过于严格,或数据处理有误');
            }
        }

        console.log('\n=== 诊断完成 ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnose();
