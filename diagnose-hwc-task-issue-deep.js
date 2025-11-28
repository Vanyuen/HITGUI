/**
 * 深度诊断：hwc-pos-20251125-5x6 任务为什么只有推算期有数据
 */

const mongoose = require('mongoose');

async function diagnoseTask() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 定义集合
        const tasksColl = db.collection('hit_dlt_hwcpositivepredictiontasks');
        const resultsColl = db.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const hit_dlts = db.collection('hit_dlts');
        const hwcOptimizedColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        const taskId = 'hwc-pos-20251125-5x6';

        console.log('========================================');
        console.log('📋 第一步：检查任务配置');
        console.log('========================================\n');

        const task = await tasksColl.findOne({ task_id: taskId });

        if (!task) {
            console.log('❌ 任务不存在！');
            return;
        }

        console.log('✅ 任务存在');
        console.log(`任务名称: ${task.task_name}`);
        console.log(`状态: ${task.status}`);
        console.log(`创建时间: ${task.created_at}`);
        console.log(`完成时间: ${task.completed_at || '未完成'}`);
        console.log(`\n期号配置:`);
        console.log(`  rangeType: ${task.range_config?.rangeType}`);
        console.log(`  recentCount: ${task.range_config?.recentCount}`);
        console.log(`\n解析后的期号列表 (${task.resolved_issues?.length || 0}期):`);
        if (task.resolved_issues && task.resolved_issues.length > 0) {
            console.log(`  ${task.resolved_issues.join(', ')}`);
        } else {
            console.log('  ❌ 无期号数据！');
        }

        console.log('\n========================================');
        console.log('📊 第二步：检查任务结果数据');
        console.log('========================================\n');

        const results = await resultsColl.find({ task_id: taskId })
            .sort({ period: 1 })
            .toArray();

        console.log(`找到 ${results.length} 条结果记录\n`);

        if (results.length === 0) {
            console.log('❌ 没有任何结果记录！\n');
        } else {
            console.log('结果记录详情：');
            results.forEach((result, idx) => {
                console.log(`\n记录 #${idx + 1}:`);
                console.log(`  期号: ${result.period}`);
                console.log(`  推算期: ${result.is_predicted ? '是' : '否'}`);
                console.log(`  红球组合数: ${result.red_combinations?.length || 0}`);
                console.log(`  蓝球组合数: ${result.blue_combinations?.length || 0}`);
                console.log(`  总组合数: ${result.total_combinations || 0}`);
                console.log(`  最高命中红球: ${result.max_red_hit || 0}/5`);
                console.log(`  最高命中蓝球: ${result.max_blue_hit || 0}/2`);
                console.log(`  一等奖数: ${result.prize_stats?.first_prize || 0}`);

                // 检查排除详情
                if (result.exclusion_details) {
                    const details = result.exclusion_details;
                    console.log(`  排除详情:`);
                    console.log(`    初始红球组合: ${details.initial_red_count || 0}`);
                    console.log(`    初始蓝球组合: ${details.initial_blue_count || 0}`);
                    console.log(`    保留红球组合: ${details.retained_red_count || 0}`);
                    console.log(`    保留蓝球组合: ${details.retained_blue_count || 0}`);
                    console.log(`    排除原因数量: ${Object.keys(details.excluded_red || {}).length} 种`);
                }
            });
        }

        console.log('\n========================================');
        console.log('🔍 第三步：验证期号数据库存在性');
        console.log('========================================\n');

        if (task.resolved_issues && task.resolved_issues.length > 0) {
            console.log('检查每个期号是否在数据库中存在：\n');

            for (const issue of task.resolved_issues) {
                const issueNum = parseInt(issue);

                // 使用String类型查询
                const record = await hit_dlts.findOne({ Issue: issue.toString() });

                const latestRecord = await hit_dlts.find().sort({ ID: -1 }).limit(1).toArray();
                const latestIssueNum = parseInt(latestRecord[0].Issue);
                const isPredicted = issueNum > latestIssueNum;

                if (record) {
                    console.log(`  ✅ 期号 ${issue}: 存在 (ID: ${record.ID}) ${isPredicted ? '[推算期]' : '[已开奖]'}`);
                } else {
                    console.log(`  ${isPredicted ? '🔮' : '❌'} 期号 ${issue}: ${isPredicted ? '推算期（正常不存在）' : '⚠️ 不存在（异常！）'}`);
                }
            }
        }

        console.log('\n========================================');
        console.log('🌡️ 第四步：检查热温冷优化表数据');
        console.log('========================================\n');

        if (task.resolved_issues && task.resolved_issues.length > 0) {
            console.log('检查每个期号对应的热温冷优化表数据：\n');

            // 生成期号对（模拟任务执行逻辑）
            const issues = task.resolved_issues;
            const pairs = [];

            for (let i = 0; i < issues.length; i++) {
                const targetIssue = issues[i];
                let baseIssue;

                if (i === issues.length - 1) {
                    // 最后一个，查询数据库
                    const previousRecord = await hit_dlts.find({
                        Issue: { $lt: targetIssue.toString() }
                    }).sort({ ID: -1 }).limit(1).toArray();

                    if (previousRecord.length > 0) {
                        baseIssue = previousRecord[0].Issue.toString();
                    }
                } else {
                    // 数组中下一个元素
                    baseIssue = issues[i + 1];
                }

                if (baseIssue) {
                    pairs.push({ base: baseIssue, target: targetIssue });
                }
            }

            console.log(`生成的期号对数量: ${pairs.length}\n`);

            for (const pair of pairs) {
                // 检查热温冷优化表中是否有这个期号对的数据
                const hwcData = await hwcOptimizedColl.findOne({
                    base_issue: pair.base.toString(),
                    target_issue: pair.target.toString()
                });

                if (hwcData) {
                    // 检查是否有热温冷数据
                    const hwcMapSize = hwcData.hot_warm_cold_data ? Object.keys(hwcData.hot_warm_cold_data).length : 0;
                    console.log(`  ✅ ${pair.base} → ${pair.target}: 数据存在 (${hwcMapSize}种热温冷比)`);
                } else {
                    console.log(`  ❌ ${pair.base} → ${pair.target}: 数据不存在！`);
                }
            }
        }

        console.log('\n========================================');
        console.log('📝 第五步：分析任务日志（如果有）');
        console.log('========================================\n');

        if (task.error_message) {
            console.log('❌ 任务错误信息:');
            console.log(`  ${task.error_message}\n`);
        } else {
            console.log('✅ 无错误信息\n');
        }

        if (task.progress_info) {
            console.log('📊 任务进度信息:');
            console.log(`  ${JSON.stringify(task.progress_info, null, 2)}\n`);
        }

        console.log('\n========================================');
        console.log('🔬 第六步：深度分析 - 任务执行逻辑问题');
        console.log('========================================\n');

        // 分析：为什么只有推算期有数据？
        console.log('可能的原因分析：\n');

        const hasOnlyPredicted = results.length === 1 && results[0]?.is_predicted;

        if (hasOnlyPredicted) {
            console.log('✅ 确认：只有推算期有结果数据\n');
            console.log('可能原因：');
            console.log('1. ❓ 期号对生成失败 - 历史期号被跳过');
            console.log('2. ❓ 热温冷优化表数据缺失 - 验证失败导致跳过历史期');
            console.log('3. ❓ 任务执行时查询条件错误 - 无法找到历史期数据');
            console.log('4. ❓ 排除条件过严 - 历史期组合全部被排除（但应该有记录）');
            console.log('5. ❓ 任务执行逻辑BUG - 只处理了推算期\n');
        }

        // 检查是否有历史期的结果记录但数据为空
        const historicalResults = results.filter(r => !r.is_predicted);
        if (historicalResults.length > 0) {
            console.log(`\n✅ 找到 ${historicalResults.length} 个历史期结果记录\n`);
            console.log('历史期数据详情：');
            historicalResults.forEach(r => {
                console.log(`  期号 ${r.period}: 红球${r.red_combinations?.length || 0}个, 蓝球${r.blue_combinations?.length || 0}个, 总${r.total_combinations || 0}个`);
            });
        } else {
            console.log('❌ 没有历史期的结果记录！');
            console.log('   这说明任务执行时根本没有处理历史期，问题在期号对生成或验证阶段。\n');
        }

        console.log('\n========================================');
        console.log('💡 诊断结论与建议');
        console.log('========================================\n');

        if (results.length === 0) {
            console.log('🔴 严重问题：任务没有生成任何结果');
            console.log('建议：检查任务创建和执行流程\n');
        } else if (results.length === 1 && results[0]?.is_predicted) {
            console.log('🟡 问题确认：只有推算期有结果，历史期被跳过');
            console.log('建议：');
            console.log('1. 检查 generateIssuePairsForTargets 函数的实际执行情况');
            console.log('2. 检查期号对验证逻辑是否过严');
            console.log('3. 检查热温冷优化表数据完整性');
            console.log('4. 查看服务器日志中的详细执行信息\n');
        } else {
            console.log('🟢 任务有多期结果');
            console.log('建议：检查历史期为什么组合数为0\n');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('已断开数据库连接');
    }
}

diagnoseTask();
