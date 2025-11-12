/**
 * 诊断期号25074的组合数异常问题
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 查询期号25074的任务结果
        const Result = mongoose.model('Result_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontaskresults'
        }));

        const result = await Result.findOne({ period: 25074 })
            .sort({ created_at: -1 })
            .lean();

        if (!result) {
            console.log('❌ 未找到期号25074的数据');
            return;
        }

        console.log('📊 期号25074基本信息:');
        console.log(`   task_id: ${result.task_id}`);
        console.log(`   组合数: ${result.combination_count?.toLocaleString()}`);
        console.log(`   is_predicted: ${result.is_predicted}`);
        console.log(`   创建时间: ${result.created_at}`);

        // 查询任务配置
        const Task = mongoose.model('Task_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontasks'
        }));

        const task = await Task.findOne({ task_id: result.task_id }).lean();

        if (!task) {
            console.log('\n❌ 未找到对应的任务配置');
            return;
        }

        console.log('\n📋 任务配置:');
        console.log(`   任务名称: ${task.task_name}`);
        console.log(`   任务状态: ${task.status}`);

        // 输出正选条件
        console.log('\n✅ 正选条件:');
        const ps = task.positive_selection || {};
        console.log(`   热温冷比: ${JSON.stringify(ps.hwc_ratios)}`);
        console.log(`   区间比: ${JSON.stringify(ps.zone_ratios)}`);
        console.log(`   和值范围: ${JSON.stringify(ps.sum_ranges)}`);
        console.log(`   跨度范围: ${JSON.stringify(ps.span_ranges)}`);
        console.log(`   奇偶比: ${JSON.stringify(ps.odd_even_ratios)}`);
        console.log(`   AC值: ${JSON.stringify(ps.ac_values)}`);

        // 输出排除条件
        console.log('\n🚫 排除条件:');
        const ec = task.exclusion_conditions || {};

        if (ec.sumExclusion?.enabled) {
            console.log(`   ✓ 历史和值排除: 最近${ec.sumExclusion.periods}期`);
        }
        if (ec.spanExclusion?.enabled) {
            console.log(`   ✓ 历史跨度排除: 最近${ec.spanExclusion.periods}期`);
        }
        if (ec.conflictPairs?.enabled) {
            console.log(`   ✓ 相克对排除: ${JSON.stringify(ec.conflictPairs)}`);
        }
        if (ec.cooccurrence?.enabled) {
            console.log(`   ✓ 同现比排除: ${JSON.stringify(ec.cooccurrence)}`);
        }
        if (ec.zoneExclusion?.enabled) {
            console.log(`   ✓ 历史区间比排除: 最近${ec.zoneExclusion.periods}期`);
        }
        if (ec.consecutiveGroups?.enabled) {
            console.log(`   ✓ 连号组数排除: ${JSON.stringify(ec.consecutiveGroups)}`);
        }
        if (ec.maxConsecutiveLength?.enabled) {
            console.log(`   ✓ 最长连号排除: ${JSON.stringify(ec.maxConsecutiveLength)}`);
        }

        // 检查排除统计
        console.log('\n📊 排除统计 (exclusion_summary):');
        const es = result.exclusion_summary || {};
        console.log(`   正选后组合数: ${es.positive_selection_count?.toLocaleString() || 'N/A'}`);
        console.log(`   历史和值排除: ${es.sum_exclude_count?.toLocaleString() || 0}`);
        console.log(`   历史跨度排除: ${es.span_exclude_count?.toLocaleString() || 0}`);
        console.log(`   历史热温冷比排除: ${es.hwc_exclude_count?.toLocaleString() || 0}`);
        console.log(`   历史区间比排除: ${es.zone_exclude_count?.toLocaleString() || 0}`);
        console.log(`   相克对排除: ${es.conflict_exclude_count?.toLocaleString() || 0}`);
        console.log(`   同现比排除: ${es.cooccurrence_exclude_count?.toLocaleString() || 0}`);
        console.log(`   连号组数排除: ${es.consecutive_groups_exclude_count?.toLocaleString() || 0}`);
        console.log(`   最长连号排除: ${es.max_consecutive_length_exclude_count?.toLocaleString() || 0}`);
        console.log(`   最终保留数量: ${es.final_count?.toLocaleString() || result.combination_count?.toLocaleString()}`);

        // 检查正选筛选详情
        console.log('\n🔍 正选筛选详情 (positive_selection_details):');
        const psd = result.positive_selection_details || {};
        console.log(`   Step1 热温冷比筛选: ${psd.step1_count?.toLocaleString() || 'N/A'}`);
        console.log(`   Step2 区间比筛选: ${psd.step2_count?.toLocaleString() || 'N/A'}`);
        console.log(`   Step3 和值筛选: ${psd.step3_count?.toLocaleString() || 'N/A'}`);
        console.log(`   Step4 跨度筛选: ${psd.step4_count?.toLocaleString() || 'N/A'}`);
        console.log(`   Step5 奇偶比筛选: ${psd.step5_count?.toLocaleString() || 'N/A'}`);
        console.log(`   Step6 AC值筛选: ${psd.step6_count?.toLocaleString() || 'N/A'}`);

        // 分析问题
        console.log('\n🔍 问题分析:');

        const finalCount = es.final_count || result.combination_count || 0;
        const positiveCount = es.positive_selection_count || psd.step6_count || 0;

        console.log(`   最终组合数: ${finalCount.toLocaleString()}`);
        console.log(`   正选后组合数: ${positiveCount.toLocaleString()}`);

        if (finalCount > 100000) {
            console.log(`\n   ⚠️ 异常：最终组合数 ${finalCount.toLocaleString()} 过多！`);

            // 检查哪些排除条件没有生效
            const totalExcluded = (es.sum_exclude_count || 0) +
                                (es.span_exclude_count || 0) +
                                (es.hwc_exclude_count || 0) +
                                (es.zone_exclude_count || 0) +
                                (es.conflict_exclude_count || 0) +
                                (es.cooccurrence_exclude_count || 0) +
                                (es.consecutive_groups_exclude_count || 0) +
                                (es.max_consecutive_length_exclude_count || 0);

            console.log(`\n   排除条件执行情况:`);
            console.log(`     总共排除: ${totalExcluded.toLocaleString()}`);
            console.log(`     理论应排除: ${positiveCount - finalCount} (如果最终是正确的)`);

            if (es.consecutive_groups_exclude_count === 0 && ec.consecutiveGroups?.enabled) {
                console.log(`\n   ❌ 连号组数排除未生效！（配置已启用但排除数为0）`);
            }
            if (es.max_consecutive_length_exclude_count === 0 && ec.maxConsecutiveLength?.enabled) {
                console.log(`   ❌ 最长连号排除未生效！（配置已启用但排除数为0）`);
            }
            if (es.conflict_exclude_count === 0 && ec.conflictPairs?.enabled) {
                console.log(`   ❌ 相克对排除未生效！（配置已启用但排除数为0）`);
            }
            if (es.cooccurrence_exclude_count === 0 && ec.cooccurrence?.enabled) {
                console.log(`   ❌ 同现比排除未生效！（配置已启用但排除数为0）`);
            }
        }

        // 检查paired_combinations字段
        console.log('\n📦 配对组合数据:');
        if (result.paired_combinations && Array.isArray(result.paired_combinations)) {
            console.log(`   paired_combinations 数量: ${result.paired_combinations.length.toLocaleString()}`);
            console.log(`   与 combination_count 一致: ${result.paired_combinations.length === result.combination_count ? '✓' : '✗'}`);

            if (result.paired_combinations.length > 0) {
                const sample = result.paired_combinations[0];
                console.log(`\n   示例数据:`);
                console.log(`     红球: ${sample.red_balls}`);
                console.log(`     蓝球: ${sample.blue_balls}`);
            }
        } else {
            console.log(`   ⚠️ paired_combinations 不存在或非数组`);
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose();
