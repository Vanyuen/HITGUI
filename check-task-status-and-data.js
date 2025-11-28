/**
 * 检查任务状态和数据
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function check() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 1. 查询所有任务（不限状态）
        const HwcPositivePredictionTask = mongoose.model(
            'HIT_DLT_HwcPositivePredictionTask',
            new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_HwcPositivePredictionTask' })
        );

        const allTasks = await HwcPositivePredictionTask.find({})
            .sort({ created_at: -1 })
            .limit(5)
            .lean();

        console.log(`📋 找到 ${allTasks.length} 个任务（最近5个）:\n`);

        for (const task of allTasks) {
            console.log(`任务: ${task.task_name}`);
            console.log(`  task_id: ${task.task_id}`);
            console.log(`  status: ${task.status}`);
            console.log(`  created_at: ${task.created_at}`);
            console.log('');
        }

        if (allTasks.length === 0) {
            console.log('❌ 没有找到任何任务');
            return;
        }

        // 2. 取最新任务
        const latestTask = allTasks[0];
        console.log(`\n🎯 检查最新任务: ${latestTask.task_name} (status: ${latestTask.status})\n`);

        // 3. 查询该任务的结果
        const HwcPositivePredictionTaskResult = mongoose.model(
            'HIT_DLT_HwcPositivePredictionTaskResult',
            new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT_HwcPositivePredictionTaskResult' })
        );

        const results = await HwcPositivePredictionTaskResult.find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .limit(2)
            .lean();

        console.log(`✅ 找到 ${results.length} 个期号结果（显示前2个）\n`);

        // 4. 查询hit_dlts数据
        const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }));

        for (const result of results) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`📊 期号 ${result.period}:`);
            console.log(`   组合数: ${result.combination_count}`);
            console.log(`   is_predicted: ${result.is_predicted}`);

            // 检查 winning_numbers
            console.log(`\n   🎯 winning_numbers:`);
            console.log(`      类型: ${typeof result.winning_numbers}`);
            console.log(`      值: ${JSON.stringify(result.winning_numbers)}`);

            // 查询hit_dlts实际数据
            const actualData = await hit_dlts.findOne({ Issue: parseInt(result.period) }).lean();

            if (actualData) {
                console.log(`\n   ✅ hit_dlts实际开奖数据存在:`);
                console.log(`      红球: [${actualData.Red1}, ${actualData.Red2}, ${actualData.Red3}, ${actualData.Red4}, ${actualData.Red5}]`);
                console.log(`      蓝球: [${actualData.Blue1}, ${actualData.Blue2}]`);

                // 对比
                if (result.winning_numbers && result.winning_numbers.red_balls) {
                    console.log(`\n   🔍 对比:`);
                    console.log(`      保存的红球: ${JSON.stringify(result.winning_numbers.red_balls)}`);
                    console.log(`      实际的红球: [${actualData.Red1}, ${actualData.Red2}, ${actualData.Red3}, ${actualData.Red4}, ${actualData.Red5}]`);
                    console.log(`      保存的蓝球: ${JSON.stringify(result.winning_numbers.blue_balls)}`);
                    console.log(`      实际的蓝球: [${actualData.Blue1}, ${actualData.Blue2}]`);
                } else {
                    console.log(`\n   ❌ 问题: winning_numbers 未保存，但hit_dlts数据存在！`);
                }
            } else {
                console.log(`\n   ⚠️ hit_dlts中无期号${result.period}（推算期）`);
            }

            // 检查 hit_analysis
            console.log(`\n   📈 hit_analysis:`);
            if (result.hit_analysis) {
                console.log(`      max_red_hit: ${result.hit_analysis.max_red_hit}`);
                console.log(`      max_blue_hit: ${result.hit_analysis.max_blue_hit}`);
                console.log(`      hit_rate: ${result.hit_analysis.hit_rate}%`);
                console.log(`      total_prize: ¥${result.hit_analysis.total_prize}`);

                if (result.hit_analysis.prize_stats) {
                    const ps = result.hit_analysis.prize_stats;
                    console.log(`\n      奖项统计:`);
                    console.log(`        一等奖: ${ps.first_prize?.count || 0}`);
                    console.log(`        二等奖: ${ps.second_prize?.count || 0}`);
                    console.log(`        三等奖: ${ps.third_prize?.count || 0}`);
                    console.log(`        四等奖: ${ps.fourth_prize?.count || 0}`);
                    console.log(`        五等奖: ${ps.fifth_prize?.count || 0}`);
                    console.log(`        六等奖: ${ps.sixth_prize?.count || 0}`);
                    console.log(`        七等奖: ${ps.seventh_prize?.count || 0}`);
                    console.log(`        八等奖: ${ps.eighth_prize?.count || 0}`);
                    console.log(`        九等奖: ${ps.ninth_prize?.count || 0}`);
                } else {
                    console.log(`\n      ❌ prize_stats 为 null/undefined`);
                }
            } else {
                console.log(`      ❌ hit_analysis 为 null`);
            }
        }

        console.log(`\n${'='.repeat(70)}`);

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

check();
