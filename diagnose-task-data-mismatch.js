/**
 * 诊断任务数据不一致问题
 * 检查 combination_count 与 paired_combinations.length 是否一致
 */

const mongoose = require('mongoose');

// MongoDB 连接
const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const HwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    result_id: String,
    task_id: String,
    period: Number,
    combination_count: Number,
    paired_combinations: Array,
    pairing_mode: String,
    red_combinations: Array,
    blue_combinations: Array,
    hit_analysis: Object,
    exclusion_summary: Object
}, { collection: 'HIT_DLT_HwcPositivePredictionTaskResult', strict: false });

const HwcPositivePredictionTaskResult = mongoose.model('DiagnoseTaskResult', HwcPositivePredictionTaskResultSchema);

async function diagnoseMismatch() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ 已连接到 MongoDB');

        const taskId = 'hwc-pos-20251111-yzc';
        const period = 25116;

        console.log(`\n🔍 检查任务: ${taskId}, 期号: ${period}\n`);

        // 查询任务结果
        const result = await HwcPositivePredictionTaskResult.findOne({
            task_id: taskId,
            period: period
        }).lean();

        if (!result) {
            console.log('❌ 未找到任务结果');
            return;
        }

        console.log('📊 数据库中的数据分析：');
        console.log('─'.repeat(80));

        // 1. combination_count
        const savedCount = result.combination_count || 0;
        console.log(`1️⃣ combination_count（保存的组合数）: ${savedCount.toLocaleString()}`);

        // 2. paired_combinations
        const hasPairedCombinations = result.paired_combinations && result.paired_combinations.length > 0;
        const pairedCount = hasPairedCombinations ? result.paired_combinations.length : 0;
        console.log(`2️⃣ paired_combinations.length（实际数组长度）: ${pairedCount.toLocaleString()}`);
        console.log(`   数据格式: ${hasPairedCombinations ? '✅ 新格式' : '❌ 旧格式'}`);

        // 3. red_combinations 和 blue_combinations
        const hasOldFormat = result.red_combinations && result.blue_combinations;
        if (hasOldFormat) {
            console.log(`3️⃣ red_combinations.length: ${result.red_combinations.length.toLocaleString()}`);
            console.log(`   blue_combinations.length: ${result.blue_combinations.length.toLocaleString()}`);
        }

        // 4. pairing_mode
        console.log(`4️⃣ pairing_mode（配对模式）: ${result.pairing_mode || '未设置'}`);

        // 5. 数据一致性检查
        console.log('\n📊 数据一致性分析：');
        console.log('─'.repeat(80));

        if (savedCount === pairedCount && pairedCount > 0) {
            console.log(`✅ 数据一致: combination_count(${savedCount}) === paired_combinations.length(${pairedCount})`);
        } else if (pairedCount === 0 && hasOldFormat) {
            console.log(`⚠️ 使用旧格式数据，需要重新配对`);
            console.log(`   - combination_count: ${savedCount}`);
            console.log(`   - 旧格式红球数: ${result.red_combinations.length}`);
            console.log(`   - 旧格式蓝球数: ${result.blue_combinations.length}`);
        } else {
            console.log(`❌ 数据不一致！`);
            console.log(`   - combination_count: ${savedCount.toLocaleString()}`);
            console.log(`   - paired_combinations.length: ${pairedCount.toLocaleString()}`);
            console.log(`   - 差异: ${Math.abs(savedCount - pairedCount).toLocaleString()}`);
        }

        // 6. 检查 paired_combinations 的第一个元素
        if (hasPairedCombinations && pairedCount > 0) {
            console.log('\n📝 paired_combinations 示例数据（第1个元素）：');
            console.log('─'.repeat(80));
            const firstPair = result.paired_combinations[0];
            console.log(JSON.stringify(firstPair, null, 2));
        }

        // 7. 检查 hit_analysis
        if (result.hit_analysis) {
            console.log('\n📊 hit_analysis（命中分析）：');
            console.log('─'.repeat(80));
            console.log(`   最高红球命中: ${result.hit_analysis.max_red_hit || 0}/5`);
            console.log(`   最高蓝球命中: ${result.hit_analysis.max_blue_hit || 0}/2`);
            console.log(`   命中率: ${(result.hit_analysis.hit_rate || 0).toFixed(2)}%`);
            console.log(`   总奖金: ¥${(result.hit_analysis.total_prize || 0).toLocaleString()}`);
        }

        // 8. 检查 exclusion_summary
        if (result.exclusion_summary) {
            console.log('\n📊 exclusion_summary（排除统计）：');
            console.log('─'.repeat(80));
            console.log(`   初始组合数: ${(result.exclusion_summary.initial_count || 0).toLocaleString()}`);
            console.log(`   最终保留数: ${(result.exclusion_summary.final_count || 0).toLocaleString()}`);
            console.log(`   和值排除: ${result.exclusion_summary.sum_exclude_count || 0}`);
            console.log(`   跨度排除: ${result.exclusion_summary.span_exclude_count || 0}`);
            console.log(`   热温冷排除: ${result.exclusion_summary.hwc_exclude_count || 0}`);
            console.log(`   区间排除: ${result.exclusion_summary.zone_exclude_count || 0}`);
            console.log(`   相克对排除: ${result.exclusion_summary.conflict_exclude_count || 0}`);
            console.log(`   连号组数排除: ${result.exclusion_summary.consecutive_groups_exclude_count || 0}`);
            console.log(`   最长连号排除: ${result.exclusion_summary.max_consecutive_length_exclude_count || 0}`);
        }

        console.log('\n' + '═'.repeat(80));
        console.log('🎯 问题定位结论：');
        console.log('═'.repeat(80));

        if (savedCount !== pairedCount) {
            console.log(`❌ 核心问题: combination_count(${savedCount}) ≠ paired_combinations.length(${pairedCount})`);
            console.log(`   这说明数据保存时就有问题！`);
            console.log(`\n可能原因：`);
            console.log(`   1. 任务执行时，combination_count 保存了错误的值`);
            console.log(`   2. paired_combinations 数组没有完整保存`);
            console.log(`   3. 数据库保存时截断了数组（超过16MB限制？）`);
        } else if (pairedCount === 0) {
            console.log(`⚠️ 数据为旧格式，需要重新配对`);
        } else {
            console.log(`✅ 数据保存正常，问题可能在导出逻辑`);
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ 已断开 MongoDB 连接');
    }
}

// 运行诊断
diagnoseMismatch();
