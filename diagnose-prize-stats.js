/**
 * 诊断奖项统计问题
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 1. 查询最新任务
        const HwcPositivePredictionTask = mongoose.model(
            'HIT_DLT_HwcPositivePredictionTask',
            new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_HwcPositivePredictionTask' })
        );

        const task = await HwcPositivePredictionTask.findOne({ status: 'completed' })
            .sort({ created_at: -1 })
            .lean();

        if (!task) {
            console.log('❌ 没有找到已完成的任务');
            return;
        }

        console.log(`📋 任务: ${task.task_name} (${task.task_id})\n`);

        // 2. 查询任务结果（直接查询集合）
        const HwcPositivePredictionTaskResult = mongoose.model(
            'HIT_DLT_HwcPositivePredictionTaskResult',
            new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_HwcPositivePredictionTaskResult' })
        );

        const results = await HwcPositivePredictionTaskResult.find({ task_id: task.task_id })
            .sort({ period: 1 })
            .limit(3)
            .lean();

        console.log(`✅ 找到 ${results.length} 个期号结果（显示前3个）:\n`);

        // 3. 查询DLT实际开奖数据
        const DLT = mongoose.model('HIT_DLT', new mongoose.Schema({}, { strict: false }));

        for (const result of results) {
            console.log(`\n📊 期号 ${result.period}:`);
            console.log(`   组合数: ${result.combination_count}`);
            console.log(`   is_predicted: ${result.is_predicted}`);

            // 检查 winning_numbers 字段
            console.log(`\n   🎯 winning_numbers (类型: ${typeof result.winning_numbers}):`);
            if (result.winning_numbers) {
                console.log(`      red_balls: ${JSON.stringify(result.winning_numbers.red_balls)}`);
                console.log(`      blue_balls: ${JSON.stringify(result.winning_numbers.blue_balls)}`);
            } else {
                console.log(`      ❌ winning_numbers 为 null/undefined`);
            }

            // 查询DLT实际数据
            const actualData = await DLT.findOne({ Issue: parseInt(result.period) }).lean();

            if (actualData) {
                console.log(`\n   ✅ DLT实际开奖数据:`);
                console.log(`      红球: [${actualData.Red1}, ${actualData.Red2}, ${actualData.Red3}, ${actualData.Red4}, ${actualData.Red5}]`);
                console.log(`      蓝球: [${actualData.Blue1}, ${actualData.Blue2}]`);
            } else {
                console.log(`\n   ⚠️ DLT中无此期号（推算期）`);
            }

            // 检查 hit_analysis
            console.log(`\n   📈 hit_analysis:`);
            if (result.hit_analysis) {
                console.log(`      max_red_hit: ${result.hit_analysis.max_red_hit}`);
                console.log(`      max_blue_hit: ${result.hit_analysis.max_blue_hit}`);

                if (result.hit_analysis.prize_stats) {
                    const ps = result.hit_analysis.prize_stats;
                    console.log(`      一等奖: ${ps.first_prize?.count || 0}`);
                    console.log(`      二等奖: ${ps.second_prize?.count || 0}`);
                    console.log(`      三等奖: ${ps.third_prize?.count || 0}`);
                    console.log(`      四等奖: ${ps.fourth_prize?.count || 0}`);
                    console.log(`      五等奖: ${ps.fifth_prize?.count || 0}`);
                    console.log(`      六等奖: ${ps.sixth_prize?.count || 0}`);
                } else {
                    console.log(`      ❌ prize_stats 为 null/undefined`);
                }
            } else {
                console.log(`      ❌ hit_analysis 为 null`);
            }

            console.log('\n' + '='.repeat(60));
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose();
