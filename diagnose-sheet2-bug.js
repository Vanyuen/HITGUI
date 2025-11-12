/**
 * Sheet 2 BUG 诊断脚本
 * 用于检查任务的排除条件配置和排除详情数据
 */

const mongoose = require('mongoose');
const { DatabaseManager } = require('./src/database/config');

async function diagnose() {
    console.log('\n🔍 ===== Sheet 2 BUG 深度诊断 =====\n');

    try {
        // 0. 确保数据库连接
        console.log('📡 正在连接数据库...');
        await DatabaseManager.initialize();

        // 等待连接就绪
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve, reject) => {
                mongoose.connection.once('open', resolve);
                mongoose.connection.once('error', reject);
                setTimeout(() => reject(new Error('数据库连接超时')), 10000);
            });
        }
        console.log('✅ 数据库连接成功\n');

        // 1. 查询最近的热温冷正选任务
        const tasks = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(5)
            .toArray();

        if (tasks.length === 0) {
            console.log('❌ 数据库中没有任何热温冷正选任务');
            mongoose.connection.close();
            return;
        }

        console.log(`📊 找到 ${tasks.length} 个最近的任务\n`);

        // 2. 逐个诊断任务
        for (const task of tasks) {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📋 任务: ${task.task_name || task.task_id}`);
            console.log(`🆔 ID: ${task.task_id}`);
            console.log(`📅 创建时间: ${task.created_at || '未知'}`);
            console.log(`📊 状态: ${task.status}`);

            // 2.1 检查排除条件配置
            console.log(`\n🔧 排除条件配置检查:`);

            const exclusionConditions = task.exclusion_conditions || {};

            // Step 7: consecutiveGroups
            const step7 = exclusionConditions.consecutiveGroups || {};
            const step7Enabled = step7.enabled || false;
            const step7Groups = step7.groups || [];
            console.log(`  Step 7 - 连号组数排除:`);
            console.log(`    enabled: ${step7Enabled} ${step7Enabled ? '✅' : '❌'}`);
            console.log(`    groups: ${step7Groups.length > 0 ? JSON.stringify(step7Groups) : '未配置'}`);

            // Step 8: maxConsecutiveLength
            const step8 = exclusionConditions.maxConsecutiveLength || {};
            const step8Enabled = step8.enabled || false;
            const step8Lengths = step8.lengths || [];
            console.log(`  Step 8 - 最长连号排除:`);
            console.log(`    enabled: ${step8Enabled} ${step8Enabled ? '✅' : '❌'}`);
            console.log(`    lengths: ${step8Lengths.length > 0 ? JSON.stringify(step8Lengths) : '未配置'}`);

            // Step 9: conflictPairs
            const step9 = exclusionConditions.conflictPairs || {};
            const step9Enabled = step9.enabled || false;
            console.log(`  Step 9 - 相克对排除:`);
            console.log(`    enabled: ${step9Enabled} ${step9Enabled ? '✅' : '❌'}`);

            // Step 10: coOccurrence
            const step10 = exclusionConditions.coOccurrence || {};
            const step10Enabled = step10.enabled || false;
            console.log(`  Step 10 - 同现比排除:`);
            console.log(`    enabled: ${step10Enabled} ${step10Enabled ? '✅' : '❌'}`);

            const anyEnabled = step7Enabled || step8Enabled || step9Enabled || step10Enabled;
            console.log(`\n  总结: ${anyEnabled ? '✅ 至少有一个排除条件启用' : '❌ 所有排除条件都未启用（这就是BUG原因！）'}`);

            // 2.2 检查任务结果
            const results = await mongoose.connection.db
                .collection('hit_dlt_hwcpositivepredictiontaskresults')
                .find({ task_id: task.task_id })
                .toArray();

            console.log(`\n📈 任务结果: ${results.length} 个期号`);

            if (results.length > 0) {
                // 取第一个期号进行详细检查
                const result = results[0];
                const period = result.period;
                console.log(`\n🔍 抽样检查期号: ${period}`);

                // 2.3 检查排除详情记录（Step 7-10）
                const exclusionRecords = await mongoose.connection.db
                    .collection('hit_dlt_exclusiondetails')
                    .find({
                        task_id: task.task_id,
                        period: period.toString(),
                        step: { $in: [7, 8, 9, 10] }
                    })
                    .toArray();

                console.log(`\n📦 排除详情记录 (Step 7-10):`);
                if (exclusionRecords.length === 0) {
                    console.log(`  ❌ 没有找到任何排除详情记录`);
                    console.log(`  ❗ 这就是 Sheet 2 显示"该期号没有排除条件数据"的原因！`);
                } else {
                    console.log(`  ✅ 找到 ${exclusionRecords.length} 条记录:`);

                    const stepStats = {};
                    for (const record of exclusionRecords) {
                        if (!stepStats[record.step]) {
                            stepStats[record.step] = {
                                count: 0,
                                excludedCount: 0,
                                detailsMapCount: 0
                            };
                        }
                        stepStats[record.step].count++;
                        stepStats[record.step].excludedCount += record.excluded_count || 0;

                        // 检查 exclusion_details_map
                        const detailsMap = record.exclusion_details_map || {};
                        const detailsKeys = Object.keys(detailsMap);
                        stepStats[record.step].detailsMapCount += detailsKeys.length;
                    }

                    for (const [step, stats] of Object.entries(stepStats).sort((a, b) => a[0] - b[0])) {
                        const stepName = {
                            '7': '连号组数排除',
                            '8': '最长连号排除',
                            '9': '相克对排除',
                            '10': '同现比排除'
                        }[step] || `Step ${step}`;

                        console.log(`    Step ${step} - ${stepName}:`);
                        console.log(`      分片记录数: ${stats.count}`);
                        console.log(`      排除组合数: ${stats.excludedCount}`);
                        console.log(`      详细原因数: ${stats.detailsMapCount}`);

                        if (stats.excludedCount === 0) {
                            console.log(`      ⚠️ 没有排除任何组合（可能是条件配置过松）`);
                        } else if (stats.detailsMapCount === 0) {
                            console.log(`      ❌ 缺少详细原因数据（这是旧版本任务）`);
                        } else if (stats.excludedCount !== stats.detailsMapCount) {
                            console.log(`      ⚠️ 详细原因数量与排除数量不匹配！`);
                        } else {
                            console.log(`      ✅ 数据完整`);
                        }
                    }

                    // 抽样检查详细原因
                    console.log(`\n  🔍 详细原因抽样:`);
                    for (const step of [7, 8, 9, 10]) {
                        const record = exclusionRecords.find(r => r.step === step);
                        if (record && record.exclusion_details_map) {
                            const detailsMap = record.exclusion_details_map;
                            const keys = Object.keys(detailsMap);
                            if (keys.length > 0) {
                                const sampleId = keys[0];
                                const detail = detailsMap[sampleId];
                                console.log(`    Step ${step}: "${detail.description || '未知'}"`);
                            }
                        }
                    }
                }
            }
        }

        console.log(`\n\n🎯 ===== 诊断结论 =====\n`);

        // 统计启用情况
        let tasksWithEnabled = 0;
        let tasksWithoutEnabled = 0;

        for (const task of tasks) {
            const ec = task.exclusion_conditions || {};
            const anyEnabled = (ec.consecutiveGroups?.enabled || false) ||
                             (ec.maxConsecutiveLength?.enabled || false) ||
                             (ec.conflictPairs?.enabled || false) ||
                             (ec.coOccurrence?.enabled || false);

            if (anyEnabled) {
                tasksWithEnabled++;
            } else {
                tasksWithoutEnabled++;
            }
        }

        console.log(`📊 启用统计:`);
        console.log(`  ✅ 启用了排除条件的任务: ${tasksWithEnabled} 个`);
        console.log(`  ❌ 未启用排除条件的任务: ${tasksWithoutEnabled} 个`);

        if (tasksWithoutEnabled > 0) {
            console.log(`\n❗ BUG 根本原因:`);
            console.log(`  1. Schema 中所有排除条件的默认值为 enabled: false`);
            console.log(`  2. 用户创建任务时未手动启用排除条件`);
            console.log(`  3. 任务执行时 Step 7-10 代码块不会执行（因为 enabled 检查失败）`);
            console.log(`  4. 没有排除详情数据保存到数据库`);
            console.log(`  5. Sheet 2 显示"该期号没有排除条件数据"`);

            console.log(`\n💡 解决方案:`);
            console.log(`  方案A: 修改 Schema 默认值为 enabled: true（影响所有新任务）`);
            console.log(`  方案B: 前端界面添加排除条件启用开关（用户手动选择）`);
            console.log(`  方案C: 导出时检测并提示"排除条件未启用，建议重新配置任务"`);
        } else {
            console.log(`\n✅ 所有任务都正确启用了排除条件，Sheet 2 应该可以正常导出`);
        }

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
    }
}

diagnose().catch(console.error);
