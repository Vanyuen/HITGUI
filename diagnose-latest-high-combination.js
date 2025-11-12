/**
 * 诊断最新任务的高组合数问题
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
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

        // 查找最新的任务
        const latestTask = await Task.findOne()
            .sort({ created_at: -1 })
            .lean();

        if (!latestTask) {
            console.log('❌ 未找到任务');
            return;
        }

        console.log('📋 最新任务信息:');
        console.log('   task_id:', latestTask.task_id);
        console.log('   task_name:', latestTask.task_name);
        console.log('   status:', latestTask.status);
        console.log('   pairing_mode:', latestTask.pairing_mode || 'undefined');
        console.log('   created_at:', latestTask.created_at);
        console.log('');

        console.log('🌡️ 正选条件:');
        console.log(JSON.stringify(latestTask.positive_selection, null, 2));
        console.log('');

        console.log('🚫 排除条件:');
        const ec = latestTask.exclusion_conditions || {};
        console.log('   相克对排除:', ec.conflictPairs?.enabled ? '✅ 启用' : '❌ 未启用');
        console.log('   历史和值排除:', ec.sum?.historical?.enabled ? `✅ 启用(${ec.sum.historical.count}期)` : '❌ 未启用');
        console.log('   历史跨度排除:', ec.span?.historical?.enabled ? `✅ 启用(${ec.span.historical.count}期)` : '❌ 未启用');
        console.log('   连号组数排除:', ec.consecutiveGroups?.enabled ? '✅ 启用' : '❌ 未启用');
        console.log('   最长连号排除:', ec.maxConsecutiveLength?.enabled ? '✅ 启用' : '❌ 未启用');
        console.log('');

        // 查询结果样本
        const results = await Result.find({ task_id: latestTask.task_id })
            .sort({ combination_count: -1 })
            .limit(3)
            .lean();

        if (results.length === 0) {
            console.log('❌ 未找到结果数据');
            return;
        }

        console.log('📊 组合数最高的3个期号:\n');
        for (const r of results) {
            const psd = r.positive_selection_details || {};
            const es = r.exclusion_summary || {};

            console.log('='.repeat(80));
            console.log(`期号 ${r.period}: ${(r.combination_count || 0).toLocaleString()} 个组合`);
            console.log('配对模式:', r.pairing_mode || 'undefined');
            console.log('红球组合数:', r.red_combinations?.length || 0);
            console.log('蓝球组合数:', r.blue_combinations?.length || 0);
            console.log('paired_combinations数:', r.paired_combinations?.length || 0);
            console.log('');

            console.log('正选统计:');
            console.log('  step1_count:', psd.step1_count || 'N/A');
            console.log('  step2_retained_count:', psd.step2_retained_count || 'N/A');
            console.log('  step3_retained_count:', psd.step3_retained_count || 'N/A');
            console.log('  step4_retained_count:', psd.step4_retained_count || 'N/A');
            console.log('  step5_retained_count:', psd.step5_retained_count || 'N/A');
            console.log('  step6_retained_count:', psd.step6_retained_count || 'N/A');
            console.log('  final_retained_count:', psd.final_retained_count || 'N/A');
            console.log('');

            console.log('排除统计:');
            console.log('  positive_selection_count:', es.positive_selection_count || 'N/A');
            console.log('  sum_exclude_count:', es.sum_exclude_count || 0);
            console.log('  span_exclude_count:', es.span_exclude_count || 0);
            console.log('  conflict_exclude_count:', es.conflict_exclude_count || 0);
            console.log('  consecutive_groups_exclude_count:', es.consecutive_groups_exclude_count || 0);
            console.log('  max_consecutive_length_exclude_count:', es.max_consecutive_length_exclude_count || 0);
            console.log('  final_count:', es.final_count || 'N/A');
            console.log('');

            console.log('🔍 计算验证:');
            const redCount = r.red_combinations?.length || 0;
            const blueCount = r.blue_combinations?.length || 0;
            const expectedCartesian = redCount * blueCount;
            console.log(`  红球(${redCount}) × 蓝球(${blueCount}) = ${expectedCartesian.toLocaleString()}`);
            console.log(`  实际 combination_count: ${(r.combination_count || 0).toLocaleString()}`);
            console.log(`  差异: ${r.combination_count === expectedCartesian ? '✅ 一致' : '❌ 不一致!'}`);
            console.log('');

            // 如果数据量不大，显示第一个红球组合样本
            if (r.red_combinations && r.red_combinations.length > 0) {
                console.log('红球组合样本(前3个):');
                for (let i = 0; i < Math.min(3, r.red_combinations.length); i++) {
                    const combo = r.red_combinations[i];
                    console.log(`  [${i + 1}] ${combo.combination || combo.balls || JSON.stringify(combo)}`);
                }
            }
            console.log('');
        }

        // 统计所有期号的组合数分布
        const allResults = await Result.find({ task_id: latestTask.task_id }).lean();
        console.log('\n📈 所有期号统计:');
        console.log(`  总期号数: ${allResults.length}`);
        const comboCounts = allResults.map(r => r.combination_count || 0);
        console.log(`  平均组合数: ${Math.round(comboCounts.reduce((a, b) => a + b, 0) / comboCounts.length).toLocaleString()}`);
        console.log(`  最小组合数: ${Math.min(...comboCounts).toLocaleString()}`);
        console.log(`  最大组合数: ${Math.max(...comboCounts).toLocaleString()}`);

    } catch (error) {
        console.error('❌ 诊断失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose();
