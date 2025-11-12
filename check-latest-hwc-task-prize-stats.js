/**
 * 检查最新热温冷任务的奖项统计
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function check() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 使用正确的集合名称
        const Task = mongoose.model('Task_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontasks'
        }));

        const Result = mongoose.model('Result_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontaskresults'
        }));

        // 1. 查询最新任务
        const latestTask = await Task.findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 没有找到任务');
            return;
        }

        console.log(`📋 最新任务: ${latestTask.task_name}`);
        console.log(`   task_id: ${latestTask.task_id}`);
        console.log(`   status: ${latestTask.status}`);
        console.log(`   created_at: ${latestTask.created_at}\n`);

        // 2. 查询该任务的结果
        const results = await Result.find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .lean();

        console.log(`✅ 找到 ${results.length} 个期号结果\n`);

        // 3. 统计奖项数据
        let totalFirstPrize = 0;
        let totalSecondPrize = 0;
        let totalThirdPrize = 0;
        let totalFourthPrize = 0;
        let totalFifthPrize = 0;
        let totalSixthPrize = 0;

        let periodsWithWinningNumbers = 0;
        let periodsWithoutWinningNumbers = 0;

        console.log('📊 期号详情（前5个）:\n');

        for (let i = 0; i < Math.min(5, results.length); i++) {
            const r = results[i];

            console.log(`${i + 1}. 期号 ${r.period}:`);
            console.log(`   组合数: ${r.combination_count}`);

            // 检查 winning_numbers 格式
            if (r.winning_numbers) {
                periodsWithWinningNumbers++;
                console.log(`   开奖号码: ✓ 有`);
                console.log(`      格式: ${JSON.stringify(r.winning_numbers)}`);
            } else {
                periodsWithoutWinningNumbers++;
                console.log(`   开奖号码: ✗ 无`);
            }

            // 检查 hit_analysis
            if (r.hit_analysis) {
                console.log(`   命中分析:`);
                console.log(`      max_red_hit: ${r.hit_analysis.max_red_hit}`);
                console.log(`      max_blue_hit: ${r.hit_analysis.max_blue_hit}`);

                if (r.hit_analysis.prize_stats) {
                    const ps = r.hit_analysis.prize_stats;
                    const first = ps.first_prize?.count || 0;
                    const second = ps.second_prize?.count || 0;
                    const third = ps.third_prize?.count || 0;
                    const fourth = ps.fourth_prize?.count || 0;
                    const fifth = ps.fifth_prize?.count || 0;
                    const sixth = ps.sixth_prize?.count || 0;

                    console.log(`      一等奖: ${first}`);
                    console.log(`      二等奖: ${second}`);
                    console.log(`      三等奖: ${third}`);
                    console.log(`      四等奖: ${fourth}`);
                    console.log(`      五等奖: ${fifth}`);
                    console.log(`      六等奖: ${sixth}`);

                    totalFirstPrize += first;
                    totalSecondPrize += second;
                    totalThirdPrize += third;
                    totalFourthPrize += fourth;
                    totalFifthPrize += fifth;
                    totalSixthPrize += sixth;
                } else {
                    console.log(`      ❌ prize_stats 为空`);
                }
            } else {
                console.log(`   ❌ hit_analysis 为空`);
            }

            console.log('');
        }

        // 统计所有期号
        for (const r of results) {
            if (r.hit_analysis && r.hit_analysis.prize_stats) {
                const ps = r.hit_analysis.prize_stats;
                if (r.period && parseInt(r.period) > 25004) {  // 只统计显示的那些
                    totalFirstPrize += (ps.first_prize?.count || 0);
                    totalSecondPrize += (ps.second_prize?.count || 0);
                    totalThirdPrize += (ps.third_prize?.count || 0);
                }
            }
        }

        console.log('='.repeat(70));
        console.log('\n📊 汇总统计:');
        console.log(`   总期数: ${results.length}`);
        console.log(`   有开奖号码: ${periodsWithWinningNumbers}`);
        console.log(`   无开奖号码: ${periodsWithoutWinningNumbers}`);
        console.log(`\n   奖项汇总:`);
        console.log(`     一等奖总数: ${totalFirstPrize}`);
        console.log(`     二等奖总数: ${totalSecondPrize}`);
        console.log(`     三等奖总数: ${totalThirdPrize}`);
        console.log(`     四等奖总数: ${totalFourthPrize}`);
        console.log(`     五等奖总数: ${totalFifthPrize}`);
        console.log(`     六等奖总数: ${totalSixthPrize}`);

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

check();
