/**
 * 诊断热温冷正选任务卡显示问题
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    task_type: String,
    period_range: mongoose.Schema.Types.Mixed,
    positive_selection: mongoose.Schema.Types.Mixed,
    exclusion_conditions: mongoose.Schema.Types.Mixed,
    output_config: mongoose.Schema.Types.Mixed,
    status: String,
    progress: mongoose.Schema.Types.Mixed,
    statistics: mongoose.Schema.Types.Mixed,
    created_at: Date
});

const HwcPositivePredictionTask = mongoose.model('HIT_DLT_HwcPositivePredictionTask', hwcPositivePredictionTaskSchema);

async function diagnose() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        console.log('📋 查询最新的热温冷正选任务...');
        const tasks = await HwcPositivePredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(3)
            .lean();

        if (tasks.length === 0) {
            console.log('❌ 没有找到任务记录');
            return;
        }

        console.log(`✅ 找到 ${tasks.length} 个任务\n`);

        tasks.forEach((task, index) => {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`任务 ${index + 1}: ${task.task_name}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`📌 任务ID: ${task.task_id}`);
            console.log(`📅 状态: ${task.status}`);
            console.log(`🕒 创建时间: ${task.created_at}`);

            console.log('\n📊 期号范围:');
            console.log(JSON.stringify(task.period_range, null, 2));

            console.log('\n🌡️ 正选条件 (positive_selection):');
            console.log(JSON.stringify(task.positive_selection, null, 2));

            console.log('\n🚫 排除条件 (exclusion_conditions):');
            console.log(JSON.stringify(task.exclusion_conditions, null, 2));

            console.log('\n⚙️ 输出配置 (output_config):');
            console.log(JSON.stringify(task.output_config, null, 2));

            if (task.statistics) {
                console.log('\n📈 统计信息:');
                console.log(JSON.stringify(task.statistics, null, 2));
            }

            // 检查任务卡显示逻辑会用到的字段
            console.log('\n🔍 任务卡显示逻辑检查:');
            const positiveSel = task.positive_selection || {};
            console.log(`  - hwc_ratios: ${JSON.stringify(positiveSel.hwc_ratios)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.hwc_ratios) ? 'Array' : typeof positiveSel.hwc_ratios}`);
            console.log(`    长度: ${positiveSel.hwc_ratios?.length || 0}`);

            console.log(`  - zone_ratios: ${JSON.stringify(positiveSel.zone_ratios)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.zone_ratios) ? 'Array' : typeof positiveSel.zone_ratios}`);
            console.log(`    长度: ${positiveSel.zone_ratios?.length || 0}`);

            console.log(`  - odd_even_ratios: ${JSON.stringify(positiveSel.odd_even_ratios)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.odd_even_ratios) ? 'Array' : typeof positiveSel.odd_even_ratios}`);
            console.log(`    长度: ${positiveSel.odd_even_ratios?.length || 0}`);

            console.log(`  - sum_ranges: ${JSON.stringify(positiveSel.sum_ranges)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.sum_ranges) ? 'Array' : typeof positiveSel.sum_ranges}`);
            console.log(`    长度: ${positiveSel.sum_ranges?.length || 0}`);

            console.log(`  - span_ranges: ${JSON.stringify(positiveSel.span_ranges)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.span_ranges) ? 'Array' : typeof positiveSel.span_ranges}`);
            console.log(`    长度: ${positiveSel.span_ranges?.length || 0}`);

            console.log(`  - ac_values: ${JSON.stringify(positiveSel.ac_values)}`);
            console.log(`    类型: ${Array.isArray(positiveSel.ac_values) ? 'Array' : typeof positiveSel.ac_values}`);
            console.log(`    长度: ${positiveSel.ac_values?.length || 0}`);

            // 检查排除条件显示
            const exclusionConds = task.exclusion_conditions || {};
            console.log('\n🚫 排除条件显示检查:');
            console.log(`  - sum.historical.enabled: ${exclusionConds.sum?.historical?.enabled}`);
            console.log(`  - span.historical.enabled: ${exclusionConds.span?.historical?.enabled}`);
            console.log(`  - hwc.historical.enabled: ${exclusionConds.hwc?.historical?.enabled}`);
            console.log(`  - zone.historical.enabled: ${exclusionConds.zone?.historical?.enabled}`);
            console.log(`  - conflictPairs.enabled: ${exclusionConds.conflictPairs?.enabled}`);
            console.log(`  - coOccurrence.enabled: ${exclusionConds.coOccurrence?.enabled}`);
            console.log(`  - consecutiveGroups.enabled: ${exclusionConds.consecutiveGroups?.enabled}`);
            console.log(`  - maxConsecutiveLength.enabled: ${exclusionConds.maxConsecutiveLength?.enabled}`);
        });

        console.log('\n\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose();
