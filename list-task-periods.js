/**
 * 列出最新任务的所有期号
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    task_name: String,
    status: String,
    created_at: Date
});

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    combination_count: Number,
    winning_numbers: mongoose.Schema.Types.Mixed,
    hit_analysis: mongoose.Schema.Types.Mixed,
    is_predicted: Boolean
});

const HwcPositivePredictionTask = mongoose.model('HIT_DLT_HwcPositivePredictionTask', hwcPositivePredictionTaskSchema);
const HwcPositivePredictionTaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult', hwcPositivePredictionTaskResultSchema);

async function listPeriods() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查询最新任务
        const task = await HwcPositivePredictionTask.findOne({ status: 'completed' })
            .sort({ created_at: -1 })
            .lean();

        if (!task) {
            console.log('❌ 没有找到已完成的任务');
            return;
        }

        console.log(`📋 最新任务: ${task.task_name} (${task.task_id})\n`);

        // 查询该任务的所有期号
        const results = await HwcPositivePredictionTaskResult.find({ task_id: task.task_id })
            .sort({ period: 1 })
            .select('period combination_count is_predicted winning_numbers hit_analysis')
            .lean();

        console.log(`✅ 找到 ${results.length} 个期号结果:\n`);

        results.forEach((r, index) => {
            const hasWinningNumbers = r.winning_numbers && (r.winning_numbers.red_balls || r.winning_numbers.blue_balls);
            const hasHitAnalysis = r.hit_analysis && r.hit_analysis.max_red_hit !== undefined;

            console.log(`${index + 1}. 期号 ${r.period}:`);
            console.log(`   组合数: ${r.combination_count}`);
            console.log(`   推算期: ${r.is_predicted ? '是' : '否'}`);
            console.log(`   开奖号码: ${hasWinningNumbers ? '✓ 有' : '✗ 无'}`);
            console.log(`   命中分析: ${hasHitAnalysis ? '✓ 有' : '✗ 无'}`);

            if (hasWinningNumbers) {
                console.log(`   红球: ${r.winning_numbers.red_balls}`);
                console.log(`   蓝球: ${r.winning_numbers.blue_balls}`);
            }

            if (hasHitAnalysis) {
                console.log(`   红球命中: ${r.hit_analysis.max_red_hit}/5`);
                console.log(`   蓝球命中: ${r.hit_analysis.max_blue_hit}/2`);
                console.log(`   一等奖: ${r.hit_analysis.prize_stats?.first_prize?.count || 0}`);
                console.log(`   二等奖: ${r.hit_analysis.prize_stats?.second_prize?.count || 0}`);
                console.log(`   三等奖: ${r.hit_analysis.prize_stats?.third_prize?.count || 0}`);
            }
            console.log('');
        });

    } catch (error) {
        console.error('❌ 查询失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 数据库连接已关闭');
    }
}

listPeriods();
