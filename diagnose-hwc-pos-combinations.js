/**
 * 诊断热温冷正选任务组合数为0的问题
 */

const mongoose = require('mongoose');

// Schema定义
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
    winning_numbers: Object,
    created_at: Date
});

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults' // 明确指定集合名称
);

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('=== 开始诊断 ===\n');

        // 1. 查找最近的任务
        const latestTask = await HwcPositivePredictionTaskResult
            .findOne({})
            .sort({ created_at: -1 })
            .select('task_id created_at')
            .lean();

        if (!latestTask) {
            console.log('❌ 数据库中没有任何热温冷正选任务结果');
            mongoose.connection.close();
            return;
        }

        console.log('📋 最新任务ID:', latestTask.task_id);
        console.log('📅 创建时间:', latestTask.created_at);
        console.log('');

        // 2. 查询该任务的所有期号结果
        const results = await HwcPositivePredictionTaskResult
            .find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .select('period combination_count red_combinations blue_combinations paired_combinations pairing_mode is_predicted')
            .lean();

        console.log(`📊 任务包含 ${results.length} 个期号\n`);

        // 3. 详细分析每个期号的数据
        console.log('=== 详细数据分析 ===\n');

        let nonZeroCount = 0;
        let zeroCount = 0;
        let predictedCount = 0;

        results.forEach((result, index) => {
            const isPredicted = result.is_predicted || false;
            const savedCount = result.combination_count || 0;
            const redCount = result.red_combinations ? result.red_combinations.length : 0;
            const blueCount = result.blue_combinations ? result.blue_combinations.length : 0;
            const pairedCount = result.paired_combinations ? result.paired_combinations.length : 0;
            const pairingMode = result.pairing_mode || '未知';

            // 计算真实组合数
            let realCount = 0;
            if (pairedCount > 0) {
                realCount = pairedCount;
            } else if (pairingMode === 'truly-unlimited') {
                realCount = redCount * blueCount;
            } else {
                realCount = redCount;
            }

            const flag = isPredicted ? '(推算)' : '';
            const status = savedCount > 0 ? '✅' : '❌';

            console.log(`${status} 期号 ${result.period}${flag}:`);
            console.log(`   - 保存的组合数: ${savedCount.toLocaleString()}`);
            console.log(`   - 红球组合数: ${redCount.toLocaleString()}`);
            console.log(`   - 蓝球组合数: ${blueCount.toLocaleString()}`);
            console.log(`   - 配对组合数: ${pairedCount.toLocaleString()}`);
            console.log(`   - 配对模式: ${pairingMode}`);
            console.log(`   - 计算的真实组合数: ${realCount.toLocaleString()}`);

            if (savedCount !== realCount) {
                console.log(`   ⚠️  保存值与计算值不一致!`);
            }

            if (savedCount > 0) {
                nonZeroCount++;
            } else {
                zeroCount++;
            }

            if (isPredicted) {
                predictedCount++;
            }

            console.log('');
        });

        // 4. 统计摘要
        console.log('=== 统计摘要 ===\n');
        console.log(`总期号数: ${results.length}`);
        console.log(`组合数>0的期号: ${nonZeroCount} 个`);
        console.log(`组合数=0的期号: ${zeroCount} 个`);
        console.log(`推算期号: ${predictedCount} 个`);
        console.log('');

        // 5. 分析问题
        console.log('=== 问题分析 ===\n');

        if (zeroCount > 0) {
            console.log('🔍 发现组合数为0的期号，可能原因:');
            console.log('   1. red_combinations 或 blue_combinations 为空数组');
            console.log('   2. combination_count 字段未正确保存');
            console.log('   3. 任务处理时排除条件过于严格，导致所有组合被过滤');
            console.log('');

            const zeroResults = results.filter(r => (r.combination_count || 0) === 0);
            console.log('组合数为0的期号列表:');
            zeroResults.forEach(r => {
                console.log(`   - 期号 ${r.period}${r.is_predicted ? ' (推算)' : ''}`);
            });
        } else {
            console.log('✅ 所有期号都有组合数据');
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
