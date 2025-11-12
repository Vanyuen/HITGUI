/**
 * 检查热温冷正选任务的结果数据
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    status: String,
    statistics: mongoose.Schema.Types.Mixed,
    created_at: Date
});

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    combination_count: Number,
    hit_analysis: mongoose.Schema.Types.Mixed,
    exclusion_summary: mongoose.Schema.Types.Mixed,
    is_predicted: Boolean,
    winning_numbers: mongoose.Schema.Types.Mixed
});

const HwcPositivePredictionTask = mongoose.model('HIT_DLT_HwcPositivePredictionTask', hwcPositivePredictionTaskSchema);
const HwcPositivePredictionTaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult', hwcPositivePredictionTaskResultSchema);

async function checkResults() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查询最新任务
        console.log('📋 查询最新任务...');
        const task = await HwcPositivePredictionTask.findOne({ status: 'completed' })
            .sort({ created_at: -1 })
            .lean();

        if (!task) {
            console.log('❌ 没有找到已完成的任务');
            return;
        }

        console.log(`✅ 找到任务: ${task.task_name} (${task.task_id})`);
        console.log(`📊 状态: ${task.status}`);
        console.log(`📈 任务统计信息:`);
        console.log(JSON.stringify(task.statistics, null, 2));

        // 查询该任务的结果数据
        console.log(`\n🔍 查询任务结果数据...`);
        const results = await HwcPositivePredictionTaskResult.find({ task_id: task.task_id })
            .sort({ period: 1 })
            .lean();

        console.log(`✅ 找到 ${results.length} 条期号结果\n`);

        if (results.length === 0) {
            console.log('❌ 该任务没有期号结果数据！');
            return;
        }

        // 检查前3条结果
        console.log('=' .repeat(80));
        console.log('前3条期号结果详细数据:');
        console.log('='.repeat(80));

        results.slice(0, 3).forEach((result, index) => {
            console.log(`\n【期号 ${result.period}】`);
            console.log(`  - combination_count: ${result.combination_count}`);
            console.log(`  - is_predicted: ${result.is_predicted}`);

            if (result.winning_numbers) {
                console.log(`  - winning_numbers:`);
                console.log(`    红球: ${result.winning_numbers.red_balls || '无'}`);
                console.log(`    蓝球: ${result.winning_numbers.blue_balls || '无'}`);
            } else {
                console.log(`  - winning_numbers: undefined`);
            }

            console.log(`  - hit_analysis:`);
            if (result.hit_analysis) {
                console.log(JSON.stringify(result.hit_analysis, null, 4));
            } else {
                console.log('    undefined 或 null');
            }

            console.log(`  - exclusion_summary:`);
            if (result.exclusion_summary) {
                console.log(JSON.stringify(result.exclusion_summary, null, 4));
            } else {
                console.log('    undefined 或 null');
            }
        });

        // 统计分析
        console.log('\n\n' + '='.repeat(80));
        console.log('统计分析:');
        console.log('='.repeat(80));

        const zeroComboResults = results.filter(r => !r.combination_count || r.combination_count === 0);
        const withHitAnalysis = results.filter(r => r.hit_analysis && Object.keys(r.hit_analysis).length > 0);
        const predictedResults = results.filter(r => r.is_predicted);

        console.log(`  - 总期数: ${results.length}`);
        console.log(`  - 组合数为0的期数: ${zeroComboResults.length}`);
        console.log(`  - 有命中分析的期数: ${withHitAnalysis.length}`);
        console.log(`  - 推算期数: ${predictedResults.length}`);

        if (zeroComboResults.length > 0) {
            console.log(`\n⚠️ 组合数为0的期号: ${zeroComboResults.map(r => r.period).join(', ')}`);
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

checkResults();
