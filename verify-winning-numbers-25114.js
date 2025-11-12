/**
 * 验证期号25114的开奖号码数据
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

const hwcPositivePredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    combination_count: Number,
    winning_numbers: mongoose.Schema.Types.Mixed,
    hit_analysis: mongoose.Schema.Types.Mixed
});

const HwcPositivePredictionTaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult', hwcPositivePredictionTaskResultSchema);

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

const DLT = mongoose.model('HIT_DLT', dltSchema);

async function verify() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        const targetPeriod = '25114';

        // 查询任务结果
        const result = await HwcPositivePredictionTaskResult.findOne({ period: targetPeriod })
            .sort({ _id: -1 })
            .lean();

        if (!result) {
            console.log(`❌ 没有找到期号${targetPeriod}的任务结果`);
            return;
        }

        console.log(`📋 期号: ${result.period}`);
        console.log(`📊 组合数: ${result.combination_count}`);
        console.log(`\n🎯 winning_numbers 原始数据 (类型: ${typeof result.winning_numbers}):`);
        console.log(JSON.stringify(result.winning_numbers, null, 2));

        // 查询DLT实际开奖数据
        const actualIssue = await DLT.findOne({ Issue: parseInt(targetPeriod) }).lean();

        if (actualIssue) {
            console.log(`\n✅ DLT实际开奖数据:`);
            console.log(`  红球: [${actualIssue.Red1}, ${actualIssue.Red2}, ${actualIssue.Red3}, ${actualIssue.Red4}, ${actualIssue.Red5}]`);
            console.log(`  蓝球: [${actualIssue.Blue1}, ${actualIssue.Blue2}]`);

            // 对比
            if (result.winning_numbers) {
                console.log(`\n🔍 保存的数据:`);
                console.log(`  red_balls: ${JSON.stringify(result.winning_numbers.red_balls)}`);
                console.log(`  blue_balls: ${JSON.stringify(result.winning_numbers.blue_balls)}`);

                console.log(`\n✓ 数据匹配检查:`);
                const expectedRed = [actualIssue.Red1, actualIssue.Red2, actualIssue.Red3, actualIssue.Red4, actualIssue.Red5];
                const expectedBlue = [actualIssue.Blue1, actualIssue.Blue2];

                const redMatch = JSON.stringify(result.winning_numbers.red_balls) === JSON.stringify(expectedRed);
                const blueMatch = JSON.stringify(result.winning_numbers.blue_balls) === JSON.stringify(expectedBlue);

                console.log(`  红球匹配: ${redMatch ? '✅' : '❌'}`);
                console.log(`  蓝球匹配: ${blueMatch ? '✅' : '❌'}`);
            } else {
                console.log(`\n❌ winning_numbers 为 null 或 undefined - 这是问题所在！`);
            }
        } else {
            console.log(`\n⚠️ 期号${targetPeriod}未开奖`);
        }

        console.log(`\n📊 hit_analysis 关键数据:`);
        if (result.hit_analysis) {
            console.log(`  max_red_hit: ${result.hit_analysis.max_red_hit}`);
            console.log(`  max_blue_hit: ${result.hit_analysis.max_blue_hit}`);
            console.log(`  一等奖: ${result.hit_analysis.prize_stats?.first_prize?.count || 0}`);
            console.log(`  二等奖: ${result.hit_analysis.prize_stats?.second_prize?.count || 0}`);
            console.log(`  三等奖: ${result.hit_analysis.prize_stats?.third_prize?.count || 0}`);
            console.log(`  六等奖: ${result.hit_analysis.prize_stats?.sixth_prize?.count || 0}`);
            console.log(`  命中率: ${result.hit_analysis.hit_rate}%`);
            console.log(`  总奖金: ¥${result.hit_analysis.total_prize}`);
        } else {
            console.log(`  ❌ hit_analysis 为 null`);
        }

    } catch (error) {
        console.error('❌ 验证失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

verify();
