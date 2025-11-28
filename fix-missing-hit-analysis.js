/**
 * 修复缺失的命中分析数据
 * 对于已有的任务结果,重新计算并保存命中分析
 */

const mongoose = require('mongoose');

// Schema定义
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

const dltSchema = new mongoose.Schema({
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
});

const hit_dlts = mongoose.model('hit_dlts', dltSchema, 'hit_dlts');

// 红球组合schema
const dltRedCombinationsSchema = new mongoose.Schema({
    combination_id: Number,
    numbers: [Number]
});

const DLTRedCombinations = mongoose.model('hit_dlts', dltRedCombinationsSchema, 'hit_dlt_redcombinations');

async function fix() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');
        console.log('='.repeat(80));
        console.log('开始修复命中分析数据');
        console.log('='.repeat(80));

        // 查找最新任务ID
        const latestResult = await HwcPositivePredictionTaskResult.findOne({}).sort({ created_at: -1 }).lean();
        if (!latestResult) {
            console.log('❌ 没有找到任何任务结果');
            mongoose.connection.close();
            return;
        }

        const taskId = latestResult.task_id;
        console.log(`\n📋 任务ID: ${taskId}\n`);

        // 查询该任务的所有期号结果
        const results = await HwcPositivePredictionTaskResult.find({ task_id: taskId }).sort({ period: 1 }).lean();
        console.log(`找到 ${results.length} 个期号结果\n`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const result of results) {
            const period = result.period;
            const isPredicted = result.is_predicted;

            console.log(`\n处理期号 ${period} ${isPredicted ? '(推算)' : '(已开奖)'}`);
            console.log('-'.repeat(80));

            if (isPredicted) {
                console.log('  ⏭️  推算期,跳过');
                skippedCount++;
                continue;
            }

            // 检查是否已有有效的命中分析
            if (result.hit_analysis && result.hit_analysis.max_red_hit > 0) {
                console.log('  ✅ 已有有效命中分析,跳过');
                skippedCount++;
                continue;
            }

            // 获取开奖号码
            const drawData = await hit_dlts.findOne({ Issue: parseInt(period) }).lean();
            if (!drawData) {
                console.log('  ❌ 未找到开奖数据,跳过');
                skippedCount++;
                continue;
            }

            const winningRed = [drawData.Red1, drawData.Red2, drawData.Red3, drawData.Red4, drawData.Red5].sort((a, b) => a - b);
            const winningBlue = [drawData.Blue1, drawData.Blue2].sort((a, b) => a - b);
            console.log(`  🎯 开奖号码: 红球[${winningRed.join(',')}] 蓝球[${winningBlue.join(',')}]`);

            // 获取红球组合详情
            const redComboIds = result.red_combinations || [];
            if (redComboIds.length === 0) {
                console.log('  ⚠️  没有红球组合数据,跳过');
                skippedCount++;
                continue;
            }

            console.log(`  🔍 查询${redComboIds.length}个红球组合...`);
            const redCombos = await DLTRedCombinations.find({
                combination_id: { $in: redComboIds }
            }).lean();

            if (redCombos.length === 0) {
                console.log('  ❌ 未找到红球组合详情,跳过');
                skippedCount++;
                continue;
            }

            // 计算命中统计
            let maxRedHit = 0;
            let maxBlueHit = 0;
            let prizeStats = {
                first_prize: { count: 0, amount: 10000000 },
                second_prize: { count: 0, amount: 500000 },
                third_prize: { count: 0, amount: 10000 }
            };

            // 蓝球组合(简单处理,假设是标准66个)
            const blueComboCount = result.blue_count || 66;

            for (const redCombo of redCombos) {
                const redNums = redCombo.numbers;
                const redHitCount = redNums.filter(n => winningRed.includes(n)).length;
                maxRedHit = Math.max(maxRedHit, redHitCount);

                // 对每个蓝球组合计算(简化处理)
                for (let b1 = 1; b1 <= 12; b1++) {
                    for (let b2 = b1 + 1; b2 <= 12; b2++) {
                        const blueNums = [b1, b2];
                        const blueHitCount = blueNums.filter(n => winningBlue.includes(n)).length;
                        maxBlueHit = Math.max(maxBlueHit, blueHitCount);

                        // 判定奖级
                        if (redHitCount === 5 && blueHitCount === 2) {
                            prizeStats.first_prize.count++;
                        } else if (redHitCount === 5 && blueHitCount === 1) {
                            prizeStats.second_prize.count++;
                        } else if (redHitCount === 5 && blueHitCount === 0) {
                            prizeStats.third_prize.count++;
                        }
                    }
                }
            }

            const redComboCount = redCombos.length;
            const totalCombos = redComboCount * blueComboCount;
            const hitCount = prizeStats.first_prize.count + prizeStats.second_prize.count + prizeStats.third_prize.count;
            const hitRate = totalCombos > 0 ? (hitCount / totalCombos) * 100 : 0;
            const totalPrize = prizeStats.first_prize.count * prizeStats.first_prize.amount +
                              prizeStats.second_prize.count * prizeStats.second_prize.amount +
                              prizeStats.third_prize.count * prizeStats.third_prize.amount;

            const newHitAnalysis = {
                max_red_hit: maxRedHit,
                max_blue_hit: maxBlueHit,
                prize_stats: prizeStats,
                hit_rate: hitRate,
                total_prize: totalPrize
            };

            const newWinningNumbers = {
                red: winningRed,
                blue: winningBlue
            };

            // 更新数据库
            await HwcPositivePredictionTaskResult.updateOne(
                { task_id: taskId, period: period },
                {
                    $set: {
                        hit_analysis: newHitAnalysis,
                        winning_numbers: newWinningNumbers,
                        is_predicted: false,
                        combination_count: totalCombos
                    }
                }
            );

            console.log(`  ✅ 更新成功:`);
            console.log(`     - 最大红球命中: ${maxRedHit}/5`);
            console.log(`     - 最大蓝球命中: ${maxBlueHit}/2`);
            console.log(`     - 一等奖: ${prizeStats.first_prize.count}注`);
            console.log(`     - 二等奖: ${prizeStats.second_prize.count}注`);
            console.log(`     - 三等奖: ${prizeStats.third_prize.count}注`);
            console.log(`     - 命中率: ${hitRate.toFixed(2)}%`);
            console.log(`     - 总奖金: ¥${totalPrize.toLocaleString()}`);
            console.log(`     - 总组合数: ${totalCombos.toLocaleString()}`);

            updatedCount++;
        }

        console.log('\n' + '='.repeat(80));
        console.log('修复完成');
        console.log('='.repeat(80));
        console.log(`✅ 更新: ${updatedCount}期`);
        console.log(`⏭️  跳过: ${skippedCount}期`);
        console.log('='.repeat(80));

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fix();
