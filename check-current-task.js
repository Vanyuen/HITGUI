/**
 * 检查当前运行任务的配对模式数据
 */

const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const PredictionTaskResultSchema = new mongoose.Schema({}, { collection: 'hit_prediction_task_results', strict: false });
const PredictionTaskResult = mongoose.model('PredictionTaskResult', PredictionTaskResultSchema);

const PredictionTaskSchema = new mongoose.Schema({}, { collection: 'hit_prediction_tasks', strict: false });
const PredictionTask = mongoose.model('PredictionTask', PredictionTaskSchema);

async function checkCurrentTask() {
    try {
        console.log('🔍 查询最新任务数据...\n');

        // 1. 查询最新的任务
        const latestTask = await PredictionTask.findOne()
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 没有找到任务数据');
            return;
        }

        console.log('📋 最新任务信息:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`任务ID: ${latestTask.task_id}`);
        console.log(`任务名称: ${latestTask.task_name || 'N/A'}`);
        console.log(`组合模式: ${latestTask.combination_mode || 'N/A'}`);
        console.log(`任务状态: ${latestTask.status || 'N/A'}`);
        console.log(`期号范围: ${latestTask.target_issues?.join(', ') || 'N/A'}`);
        console.log(`创建时间: ${latestTask.created_at || 'N/A'}`);

        // 2. 查询该任务的结果
        const results = await PredictionTaskResult.find({
            task_id: latestTask.task_id
        })
        .sort({ period: 1 })
        .lean();

        console.log(`\n📊 找到 ${results.length} 期结果\n`);

        if (results.length === 0) {
            console.log('⚠️ 任务可能还在处理中，暂无结果数据');
            return;
        }

        // 3. 详细分析
        console.log('🔍 各期数据分析:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        let hasNewPairingMode = 0;
        let hasOldData = 0;

        for (const result of results) {
            const period = result.period;
            const redCount = result.red_combinations?.length || 0;
            const blueCount = result.blue_combinations?.length || 0;
            const combinationCount = result.combination_count || 0;
            const pairingMode = result.pairing_mode;
            const hasPairingIndices = result.blue_pairing_indices && result.blue_pairing_indices.length > 0;

            console.log(`📅 期号: ${period}`);
            console.log(`   红球: ${redCount}个`);
            console.log(`   蓝球: ${blueCount}个`);
            console.log(`   配对模式: ${pairingMode || '❌ 未设置（旧数据）'}`);
            console.log(`   配对索引: ${hasPairingIndices ? `✅ 有 (${result.blue_pairing_indices.length}个)` : '❌ 无'}`);
            console.log(`   保存的组合数: ${combinationCount.toLocaleString()}`);

            // 计算理论组合数
            let theoreticalCount;
            let calculationMode;
            if (pairingMode === 'unlimited') {
                theoreticalCount = redCount; // 1:1配对
                calculationMode = '1:1配对';
                hasNewPairingMode++;
            } else {
                theoreticalCount = redCount * blueCount; // 笛卡尔积
                calculationMode = '笛卡尔积';
                hasOldData++;
            }

            console.log(`   理论组合数: ${theoreticalCount.toLocaleString()} (${calculationMode})`);

            // 验证
            const isCorrect = combinationCount === theoreticalCount;
            console.log(`   数据验证: ${isCorrect ? '✅ 正确' : '⚠️ 不匹配'}`);

            if (!isCorrect) {
                const difference = combinationCount - theoreticalCount;
                console.log(`   ⚠️ 差异: ${difference.toLocaleString()}`);
            }

            // 中奖统计
            if (result.hit_analysis?.prize_stats) {
                const ps = result.hit_analysis.prize_stats;
                const total = (ps.first_prize?.count || 0) +
                             (ps.second_prize?.count || 0) +
                             (ps.third_prize?.count || 0);

                console.log(`   🏆 中奖: 一等${ps.first_prize?.count || 0} 二等${ps.second_prize?.count || 0} 三等${ps.third_prize?.count || 0}`);
                console.log(`   💰 奖金: ¥${(result.hit_analysis.total_prize || 0).toLocaleString()}`);
            }

            console.log('');
        }

        // 4. 总结
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 数据总结:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`任务组合模式: ${latestTask.combination_mode}`);
        console.log(`已完成期数: ${results.length}`);
        console.log(`使用新算法期数: ${hasNewPairingMode} (pairing_mode=unlimited)`);
        console.log(`使用旧算法期数: ${hasOldData} (无pairing_mode或其他模式)`);

        if (latestTask.combination_mode === 'unlimited') {
            console.log('\n💡 任务使用普通无限制模式:');
            if (hasNewPairingMode === results.length) {
                console.log('   ✅ 所有期号都使用了修复后的1:1配对算法');
                console.log('   ✅ 中奖统计应该是准确的（不再虚高66倍）');
            } else if (hasNewPairingMode > 0) {
                console.log(`   ⚠️ ${hasNewPairingMode}期使用了新算法，${hasOldData}期使用了旧算法`);
                console.log('   ⚠️ 部分数据可能不准确');
            } else {
                console.log('   ❌ 所有期号都使用了旧算法（笛卡尔积）');
                console.log('   ❌ 中奖统计虚高66倍，建议重新运行任务');
            }
        }

        // 5. 特别检查期号25101
        const period25101 = results.find(r => r.period === '25101');
        if (period25101) {
            console.log('\n🎯 特别关注期号25101:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`红球组合: ${period25101.red_combinations?.length || 0}`);
            console.log(`蓝球组合: ${period25101.blue_combinations?.length || 0}`);
            console.log(`总组合数: ${(period25101.combination_count || 0).toLocaleString()}`);
            console.log(`配对模式: ${period25101.pairing_mode || '未设置'}`);
            console.log(`配对索引: ${period25101.blue_pairing_indices ? '有' : '无'}`);

            if (period25101.hit_analysis) {
                const ha = period25101.hit_analysis;
                console.log(`\n中奖统计:`);
                console.log(`  一等奖: ${ha.prize_stats?.first_prize?.count || 0}次`);
                console.log(`  二等奖: ${ha.prize_stats?.second_prize?.count || 0}次`);
                console.log(`  三等奖: ${ha.prize_stats?.third_prize?.count || 0}次`);
                console.log(`  总奖金: ¥${(ha.total_prize || 0).toLocaleString()}`);
            }

            // 验证25101的数据
            const redCount = period25101.red_combinations?.length || 0;
            if (period25101.pairing_mode === 'unlimited') {
                console.log(`\n✅ 使用1:1配对模式`);
                console.log(`   理论组合数 = 红球数 = ${redCount.toLocaleString()}`);
                console.log(`   实际组合数 = ${(period25101.combination_count || 0).toLocaleString()}`);
                const match = period25101.combination_count === redCount;
                console.log(`   ${match ? '✅ 数据正确' : '❌ 数据不匹配'}`);
            } else {
                const blueCount = period25101.blue_combinations?.length || 0;
                console.log(`\n⚠️ 使用笛卡尔积模式（可能是旧数据）`);
                console.log(`   理论组合数 = 红球数 × 蓝球数 = ${redCount} × ${blueCount} = ${(redCount * blueCount).toLocaleString()}`);
                console.log(`   实际组合数 = ${(period25101.combination_count || 0).toLocaleString()}`);
                console.log(`   ⚠️ 如果这是普通无限制任务，中奖统计可能虚高66倍`);
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n📊 数据库连接已关闭');
    }
}

checkCurrentTask();
