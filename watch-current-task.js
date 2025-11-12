/**
 * 持续监控当前最新任务直到完成
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

async function watchTask() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 获取最新任务
        const latestTasks = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();

        if (latestTasks.length === 0) {
            console.log('❌ 未找到任何任务');
            process.exit(0);
        }

        const task = latestTasks[0];
        const taskId = task.task_id;

        console.log(`👀 开始监控任务: ${taskId}`);
        console.log(`   任务名称: ${task.task_name}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log('⏳ 等待任务完成...\n');

        let checkCount = 0;
        const maxChecks = 120; // 最多检查120次（10分钟）
        const checkInterval = 5000; // 每5秒检查一次

        while (checkCount < maxChecks) {
            checkCount++;

            // 查询任务状态
            const currentTask = await mongoose.connection.db
                .collection('hit_dlt_hwcpositivepredictiontasks')
                .findOne({ task_id: taskId });

            if (!currentTask) {
                console.log('\n❌ 任务不存在');
                break;
            }

            const status = currentTask.status;
            const progress = currentTask.progress?.percentage || 0;
            const current = currentTask.progress?.current || 0;
            const total = currentTask.progress?.total || 0;
            const currentIssue = currentTask.progress?.current_issue || '';

            process.stdout.write(`\r[${checkCount}/${maxChecks}] 状态: ${status} | 进度: ${progress}% (${current}/${total}) | 当前: ${currentIssue}     `);

            if (status === 'completed') {
                console.log('\n\n✅ 任务已完成！\n');

                // 检查排除详情
                const exclusionRecords = await mongoose.connection.db
                    .collection('HIT_DLT_ExclusionDetails')
                    .find({ task_id: taskId })
                    .toArray();

                console.log(`📊 排除详情记录总数: ${exclusionRecords.length}\n`);

                if (exclusionRecords.length === 0) {
                    console.log('❌ 任务完成但没有排除详情记录！');
                    console.log('⚠️ 这说明修复未生效或数据保存失败\n');
                    console.log('💡 可能的原因:');
                    console.log('1. 应用使用的仍是旧代码（未重启）');
                    console.log('2. 排除详情保存时出错');
                    console.log('3. 数据库写入权限问题\n');
                    console.log('请检查应用的控制台日志，查找错误信息');
                } else {
                    console.log('🎉🎉🎉 修复已生效！找到排除详情记录！\n');

                    // 按Step分组统计
                    const stepStats = {};
                    for (let step = 2; step <= 10; step++) {
                        stepStats[step] = {
                            recordCount: 0,
                            totalExcluded: 0,
                            hasDetailsMap: 0,
                            periods: new Set()
                        };
                    }

                    for (const record of exclusionRecords) {
                        const step = record.step;
                        if (stepStats[step]) {
                            stepStats[step].recordCount++;
                            stepStats[step].totalExcluded += record.excluded_count || 0;
                            stepStats[step].periods.add(record.period);

                            if (record.exclusion_details_map && Object.keys(record.exclusion_details_map).length > 0) {
                                stepStats[step].hasDetailsMap++;
                            }
                        }
                    }

                    console.log('📊 按Step分组统计:');
                    console.log('┌───────────────┬────────────┬──────────────┬──────────────┬────────────┐');
                    console.log('│  Step         │ 记录数     │ 排除组合数   │ 有detailsMap │  期号数    │');
                    console.log('├───────────────┼────────────┼──────────────┼──────────────┼────────────┤');

                    let allStepsHaveDetails = true;
                    for (let step = 2; step <= 10; step++) {
                        const stats = stepStats[step];
                        const stepName = getStepName(step);
                        const hasDetailsMapStr = stats.hasDetailsMap > 0 ? '✅ 有' : '❌ 无';

                        if (stats.recordCount > 0 && stats.hasDetailsMap === 0) {
                            allStepsHaveDetails = false;
                        }

                        console.log(`│ ${step.toString().padStart(2)} - ${stepName.padEnd(9)} │ ${stats.recordCount.toString().padEnd(10)} │ ${stats.totalExcluded.toString().padEnd(12)} │ ${hasDetailsMapStr.padEnd(12)} │ ${stats.periods.size.toString().padEnd(10)} │`);
                    }
                    console.log('└───────────────┴────────────┴──────────────┴──────────────┴────────────┘\n');

                    // 显示样例详细原因
                    console.log('📝 样例排除原因:');
                    let foundSample = false;
                    for (let step = 2; step <= 10; step++) {
                        const stepRecords = exclusionRecords.filter(r => r.step === step);
                        if (stepRecords.length > 0 && stepRecords[0].exclusion_details_map) {
                            const mapKeys = Object.keys(stepRecords[0].exclusion_details_map);
                            if (mapKeys.length > 0) {
                                const firstKey = mapKeys[0];
                                const detail = stepRecords[0].exclusion_details_map[firstKey];
                                console.log(`   Step ${step} (${getStepName(step)}): ${detail.description || JSON.stringify(detail)}`);
                                foundSample = true;
                                if (step >= 5) break; // 只显示前几个样例
                            }
                        }
                    }

                    if (!foundSample) {
                        console.log('   ⚠️ 未找到详细原因样例');
                    }

                    console.log('\n' + '='.repeat(70));
                    if (allStepsHaveDetails) {
                        console.log('✅✅✅ 完美！所有Step都有详细原因记录！');
                        console.log('✅✅✅ Sheet2现在应该能正常显示完整数据！');
                    } else {
                        console.log('⚠️ 部分Step没有详细原因，但基本数据已保存');
                        console.log('✅ Sheet2应该能显示数据（可能部分原因为空）');
                    }
                    console.log('='.repeat(70));
                    console.log('\n💡 下一步：导出Excel文件，检查Sheet2是否有数据\n');
                }

                break;
            } else if (status === 'failed') {
                console.log('\n\n❌ 任务执行失败！');
                console.log('请检查应用日志查看错误信息');
                break;
            }

            // 等待5秒后继续检查
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        if (checkCount >= maxChecks) {
            console.log('\n\n⏰ 监控超时（10分钟）');
            console.log('   任务可能需要更长时间，请稍后手动检查');
            console.log('   运行: node monitor-latest-task.js');
        }

    } catch (error) {
        console.error('\n❌ 监控失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

function getStepName(step) {
    const names = {
        2: '区间比',
        3: '和值',
        4: '跨度',
        5: '奇偶比',
        6: 'AC值',
        7: '连号组数',
        8: '最长连号',
        9: '相克对',
        10: '同现比'
    };
    return names[step] || '未知';
}

watchTask().catch(console.error);
