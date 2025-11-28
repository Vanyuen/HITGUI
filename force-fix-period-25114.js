/**
 * 强制修复期号25114的数据
 * 不论is_predicted状态如何,都进行修复
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
        console.log('强制修复期号25114');
        console.log('='.repeat(80));

        // 查找期号25114的最新结果
        const result = await HwcPositivePredictionTaskResult
            .findOne({ period: 25114 })
            .sort({ created_at: -1 })
            .lean();

        if (!result) {
            console.log('\n❌ 未找到期号25114的任务结果');
            mongoose.connection.close();
            return;
        }

        const taskId = result.task_id;
        console.log(`\n📋 任务ID: ${taskId}`);
        console.log(`📊 期号: ${result.period}`);
        console.log(`📍 当前状态:`);
        console.log(`   - is_predicted: ${result.is_predicted}`);
        console.log(`   - combination_count: ${result.combination_count || 'undefined'}`);
        console.log(`   - red_combinations: ${result.red_combinations?.length || 0}个`);
        console.log(`   - blue_count: ${result.blue_count || 'undefined'}`);

        // 检查开奖数据
        const drawData = await hit_dlts.findOne({ Issue: 25114 }).lean();
        if (!drawData) {
            console.log('\n❌ 未找到期号25114的开奖数据');
            mongoose.connection.close();
            return;
        }

        const winningRed = [drawData.Red1, drawData.Red2, drawData.Red3, drawData.Red4, drawData.Red5].sort((a, b) => a - b);
        const winningBlue = [drawData.Blue1, drawData.Blue2].sort((a, b) => a - b);
        console.log(`\n🎯 开奖号码:`);
        console.log(`   - 红球: [${winningRed.join(', ')}]`);
        console.log(`   - 蓝球: [${winningBlue.join(', ')}]`);

        // 获取红球组合详情
        const redComboIds = result.red_combinations || [];
        if (redComboIds.length === 0) {
            console.log('\n⚠️  没有红球组合数据,无法计算命中分析');
            mongoose.connection.close();
            return;
        }

        console.log(`\n🔍 查询${redComboIds.length}个红球组合...`);
        const redCombos = await DLTRedCombinations.find({
            combination_id: { $in: redComboIds }
        }).lean();

        console.log(`   ✅ 找到${redCombos.length}个红球组合详情`);

        // 计算命中统计
        console.log(`\n💡 开始计算命中分析...`);
        let maxRedHit = 0;
        let maxBlueHit = 0;
        let prizeStats = {
            first_prize: { count: 0, amount: 10000000 },
            second_prize: { count: 0, amount: 500000 },
            third_prize: { count: 0, amount: 10000 }
        };

        // 蓝球组合(标准66个)
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

        console.log(`\n📊 计算结果:`);
        console.log(`   - 最大红球命中: ${maxRedHit}/5`);
        console.log(`   - 最大蓝球命中: ${maxBlueHit}/2`);
        console.log(`   - 一等奖: ${prizeStats.first_prize.count}注`);
        console.log(`   - 二等奖: ${prizeStats.second_prize.count}注`);
        console.log(`   - 三等奖: ${prizeStats.third_prize.count}注`);
        console.log(`   - 命中率: ${hitRate.toFixed(2)}%`);
        console.log(`   - 总奖金: ¥${totalPrize.toLocaleString()}`);
        console.log(`   - 总组合数: ${totalCombos.toLocaleString()}`);

        // 更新数据库
        console.log(`\n💾 开始更新数据库...`);
        await HwcPositivePredictionTaskResult.updateOne(
            { task_id: taskId, period: 25114 },
            {
                $set: {
                    hit_analysis: newHitAnalysis,
                    winning_numbers: newWinningNumbers,
                    is_predicted: false,  // 修正为已开奖
                    combination_count: totalCombos
                }
            }
        );

        console.log(`\n` + '='.repeat(80));
        console.log('✅ 修复成功!');
        console.log('='.repeat(80));
        console.log(`\n期号25114已经被标记为"已开奖",并重新计算了命中分析。`);
        console.log(`现在前端应该显示正确的数据,而不是"(推算)"标签和全零数据。\n`);

        mongoose.connection.close();

    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fix();
