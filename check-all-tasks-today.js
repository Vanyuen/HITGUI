/**
 * 检查今天创建的所有任务
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function check() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        const Task = mongoose.model('Task_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontasks'
        }));

        const Result = mongoose.model('Result_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontaskresults'
        }));

        // 查询今天创建的任务
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tasks = await Task.find({
            created_at: { $gte: today }
        }).sort({ created_at: -1 }).lean();

        console.log(`📋 今天创建的任务数: ${tasks.length}\n`);

        for (const task of tasks) {
            console.log(`${'='.repeat(80)}`);
            console.log(`📦 任务: ${task.task_name}`);
            console.log(`   task_id: ${task.task_id}`);
            console.log(`   status: ${task.status}`);
            console.log(`   created_at: ${task.created_at}`);
            console.log(`   completed_at: ${task.completed_at || 'N/A'}`);

            // 查询该任务的结果统计
            const results = await Result.find({ task_id: task.task_id }).lean();
            console.log(`\n   期号结果数: ${results.length}`);

            if (results.length > 0) {
                // 统计异常数据
                let normalResults = 0;
                let anomalyResults = 0;
                let totalCombinations = 0;
                let resultsWithoutPaired = 0;
                let resultsWithoutExclusion = 0;

                for (const r of results) {
                    totalCombinations += r.combination_count || 0;

                    // 检查 paired_combinations
                    if (!r.paired_combinations || r.paired_combinations.length === 0) {
                        resultsWithoutPaired++;
                    }

                    // 检查 exclusion_summary
                    const es = r.exclusion_summary || {};
                    const totalExcluded = (es.sum_exclude_count || 0) +
                                        (es.span_exclude_count || 0) +
                                        (es.conflict_exclude_count || 0) +
                                        (es.consecutive_groups_exclude_count || 0) +
                                        (es.max_consecutive_length_exclude_count || 0);

                    if (totalExcluded === 0) {
                        resultsWithoutExclusion++;
                    }

                    // 判断是否异常
                    if ((r.combination_count || 0) > 50000 || totalExcluded === 0) {
                        anomalyResults++;
                    } else {
                        normalResults++;
                    }
                }

                console.log(`\n   数据质量:`);
                console.log(`     正常期号: ${normalResults}`);
                console.log(`     异常期号: ${anomalyResults} ${anomalyResults > 0 ? '⚠️' : ''}`);
                console.log(`     平均组合数: ${Math.round(totalCombinations / results.length).toLocaleString()}`);
                console.log(`     无paired_combinations: ${resultsWithoutPaired} ${resultsWithoutPaired > 0 ? '⚠️' : ''}`);
                console.log(`     无排除统计: ${resultsWithoutExclusion} ${resultsWithoutExclusion > 0 ? '⚠️' : ''}`);

                // 显示几个样本
                console.log(`\n   样本数据（前3个期号）:`);
                for (let i = 0; i < Math.min(3, results.length); i++) {
                    const r = results[i];
                    const es = r.exclusion_summary || {};
                    const totalExcluded = (es.conflict_exclude_count || 0) +
                                        (es.consecutive_groups_exclude_count || 0) +
                                        (es.max_consecutive_length_exclude_count || 0);

                    console.log(`     期号${r.period}: ${(r.combination_count || 0).toLocaleString()}组合, 排除${totalExcluded}, paired: ${r.paired_combinations?.length || 0}`);
                }
            }

            console.log('');
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 数据库连接已关闭');
    }
}

check();
