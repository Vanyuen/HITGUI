/**
 * 诊断为什么所有组合都被排除（combination_count = 0）
 */

const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n===== 诊断0组合问题 =====\n');

        const db = mongoose.connection.db;

        // 1. 查询最新任务
        const latestTask = await db.collection('hit_dlt_hwcpositivepredictiontasks').findOne(
            {},
            { sort: { created_at: -1 } }
        );

        if (!latestTask) {
            console.log('❌ 没有找到任务');
            mongoose.connection.close();
            return;
        }

        console.log('【任务信息】');
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  基准期号: ${latestTask.base_issue}`);
        console.log(`  预测期号范围: ${latestTask.target_issues ? latestTask.target_issues.length : 0}期`);
        console.log(`  状态: ${latestTask.status}`);
        console.log();

        // 2. 查询任务的热温冷选择条件
        console.log('【热温冷选择条件】');
        if (latestTask.positive_selection) {
            const ps = latestTask.positive_selection;
            console.log(`  红球热温冷比: ${JSON.stringify(ps.red_hot_warm_cold_ratios || [])}`);
            console.log(`  分区比: ${JSON.stringify(ps.zone_ratios || [])}`);
            console.log(`  奇偶比: ${JSON.stringify(ps.odd_even_ratios || [])}`);
            console.log(`  大小比: ${JSON.stringify(ps.large_small_ratios || [])}`);
            console.log(`  和值范围: ${ps.sum_range ? `${ps.sum_range.min}-${ps.sum_range.max}` : '未设置'}`);
            console.log(`  跨度范围: ${ps.span_range ? `${ps.span_range.min}-${ps.span_range.max}` : '未设置'}`);
        } else {
            console.log('  ❌ 无热温冷选择条件');
        }
        console.log();

        // 3. 查询第一期的结果
        const firstResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').findOne(
            { task_id: latestTask.task_id },
            { sort: { period: 1 } }
        );

        if (!firstResult) {
            console.log('❌ 没有找到任务结果');
            mongoose.connection.close();
            return;
        }

        console.log('【第一期结果】');
        console.log(`  期号: ${firstResult.period}`);
        console.log(`  组合数: ${firstResult.combination_count}`);
        console.log(`  红球组合: ${firstResult.red_combinations || 0}`);
        console.log(`  蓝球组合: ${firstResult.blue_combinations || 0}`);
        console.log(`  配对模式: ${firstResult.pairing_mode}`);
        console.log();

        // 4. 查询该期的排除详情
        const exclusionDetails = await db.collection('hit_dlt_exclusiondetails').find({
            task_id: latestTask.task_id,
            period: firstResult.period.toString()
        }).sort({ step: 1 }).toArray();

        console.log('【排除详情统计】');
        console.log(`  总记录数: ${exclusionDetails.length}`);
        console.log();

        if (exclusionDetails.length > 0) {
            console.log('  详细统计:');
            for (const detail of exclusionDetails) {
                const excludedCount = detail.excluded_count || 0;
                const condition = detail.condition || `Step ${detail.step}`;
                console.log(`    Step ${detail.step} (${condition}): 排除 ${excludedCount} 个组合`);

                // 显示metadata（如果有）
                if (detail.metadata) {
                    const keys = Object.keys(detail.metadata);
                    if (keys.length > 0) {
                        console.log(`      Metadata: ${keys.join(', ')}`);
                    }
                }
            }
        }
        console.log();

        // 5. 关键问题：检查热温冷优化表
        console.log('【热温冷优化表检查】');
        const hwcOptimizedCount = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments({});
        console.log(`  总记录数: ${hwcOptimizedCount}`);

        if (hwcOptimizedCount > 0) {
            // 检查是否有该任务需要的期号对
            const baseIssue = latestTask.base_issue;
            const firstTargetIssue = firstResult.period.toString();

            const hwcRecord = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
                base_issue: baseIssue,
                target_issue: firstTargetIssue
            });

            console.log(`  期号对 ${baseIssue} → ${firstTargetIssue}: ${hwcRecord ? '✅ 存在' : '❌ 不存在'}`);

            if (hwcRecord) {
                console.log(`  热温冷数据类型: ${typeof hwcRecord.hot_warm_cold_data}`);
                console.log(`  总组合数: ${hwcRecord.total_combinations}`);

                // 检查是否包含所需的热温冷比
                if (latestTask.positive_selection?.red_hot_warm_cold_ratios) {
                    const requiredRatios = latestTask.positive_selection.red_hot_warm_cold_ratios;
                    console.log(`\n  需要的热温冷比: ${JSON.stringify(requiredRatios)}`);

                    const hwcData = hwcRecord.hot_warm_cold_data;
                    for (const ratio of requiredRatios) {
                        const key = `${ratio.hot}:${ratio.warm}:${ratio.cold}`;
                        const hasKey = hwcData && hwcData[key];
                        const count = hasKey ? (Array.isArray(hwcData[key]) ? hwcData[key].length : 0) : 0;
                        console.log(`    ${key}: ${hasKey ? `✅ ${count}个组合` : '❌ 不存在'}`);
                    }
                }
            } else {
                console.log('  ⚠️ 热温冷优化表中缺少该期号对的数据！');
                console.log('  这会导致 Step 1 无法获取任何组合，最终结果为0！');
            }
        } else {
            console.log('  ❌ 热温冷优化表完全为空！');
        }
        console.log();

        // 6. 诊断结论
        console.log('【诊断结论】');

        const issues = [];

        if (!latestTask.positive_selection || !latestTask.positive_selection.red_hot_warm_cold_ratios) {
            issues.push('❌ 任务缺少热温冷选择条件');
        }

        if (hwcOptimizedCount === 0) {
            issues.push('❌ 热温冷优化表为空');
        } else {
            const baseIssue = latestTask.base_issue;
            const firstTargetIssue = firstResult.period.toString();
            const hwcRecord = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({
                base_issue: baseIssue,
                target_issue: firstTargetIssue
            });

            if (!hwcRecord) {
                issues.push(`❌ 缺少期号对 ${baseIssue} → ${firstTargetIssue} 的热温冷数据`);
            }
        }

        if (firstResult.combination_count === 0) {
            issues.push('❌ 最终保留组合数为0');
        }

        if (issues.length > 0) {
            console.log('  发现以下问题:\n');
            issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. ${issue}`);
            });
        } else {
            console.log('  ✅ 未发现明显问题，需要进一步调试运行时逻辑');
        }

        console.log('\n===== 诊断完成 =====\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('诊断错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnose();
