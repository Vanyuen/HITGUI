/**
 * 检查任务结果数据的完整性
 */

const mongoose = require('mongoose');

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    combination_count: Number,
    red_count: Number,
    blue_count: Number,
    red_combinations: [Number],
    blue_combinations: [[Number]],
    paired_combinations: [{ red_id: Number, blue_indices: [Number] }],
    pairing_mode: String,
    hit_analysis: Object,
    exclusion_summary: Object,
    is_predicted: Boolean,
    winning_numbers: Object,
    created_at: Date
});

const HwcPositivePredictionTaskResult = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    hwcPositivePredictionTaskResultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 查找最新任务
        const latestResult = await HwcPositivePredictionTaskResult
            .findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestResult) {
            console.log('❌ 没有找到任何任务结果');
            mongoose.connection.close();
            return;
        }

        const taskId = latestResult.task_id;
        console.log(`📋 任务ID: ${taskId}\n`);

        // 查询该任务的所有期号结果
        const results = await HwcPositivePredictionTaskResult
            .find({ task_id: taskId })
            .sort({ period: 1 })
            .lean();

        console.log(`找到 ${results.length} 个期号结果\n`);
        console.log('='.repeat(100));

        // 检查每个期号的数据
        results.forEach((result, index) => {
            console.log(`\n期号 ${result.period} ${result.is_predicted ? '(推算)' : '(已开奖)'}`);
            console.log(`-`.repeat(100));

            console.log(`  combination_count: ${result.combination_count || 'undefined'}`);
            console.log(`  red_count: ${result.red_count || 'undefined'}`);
            console.log(`  blue_count: ${result.blue_count || 'undefined'}`);
            console.log(`  pairing_mode: ${result.pairing_mode || 'undefined'}`);
            console.log(`  is_predicted: ${result.is_predicted} (类型: ${typeof result.is_predicted})`);

            // 检查hit_analysis
            if (result.hit_analysis) {
                const ha = result.hit_analysis;
                console.log(`  hit_analysis: ✅ 存在`);
                console.log(`    - max_red_hit: ${ha.max_red_hit}`);
                console.log(`    - max_blue_hit: ${ha.max_blue_hit}`);
                console.log(`    - hit_rate: ${ha.hit_rate}`);
                console.log(`    - total_prize: ${ha.total_prize}`);

                if (ha.prize_stats) {
                    console.log(`    - prize_stats: ✅ 存在`);
                    console.log(`      - first_prize: ${ha.prize_stats.first_prize?.count || 0}`);
                    console.log(`      - second_prize: ${ha.prize_stats.second_prize?.count || 0}`);
                    console.log(`      - third_prize: ${ha.prize_stats.third_prize?.count || 0}`);
                } else {
                    console.log(`    - prize_stats: ❌ 不存在`);
                }
            } else {
                console.log(`  hit_analysis: ❌ 不存在或为null`);
            }

            // 检查winning_numbers
            if (result.winning_numbers) {
                console.log(`  winning_numbers: ✅ 存在`);
                console.log(`    - red: [${result.winning_numbers.red}]`);
                console.log(`    - blue: [${result.winning_numbers.blue}]`);
            } else {
                console.log(`  winning_numbers: ❌ 不存在`);
            }

            // 检查exclusion_summary
            if (result.exclusion_summary) {
                console.log(`  exclusion_summary: ✅ 存在`);
            } else {
                console.log(`  exclusion_summary: ❌ 不存在`);
            }
        });

        console.log('\n' + '='.repeat(100));
        console.log('\n✅ 检查完成');

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

check();
