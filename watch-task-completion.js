/**
 * 持续监控任务直到完成，然后显示排除详情
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

        const taskId = 'hwc-pos-20251111-ciw';  // 最新任务ID

        console.log(`👀 开始监控任务: ${taskId}`);
        console.log('⏳ 等待任务完成...\n');

        let checkCount = 0;
        const maxChecks = 60; // 最多检查60次（5分钟）
        const checkInterval = 5000; // 每5秒检查一次

        while (checkCount < maxChecks) {
            checkCount++;

            // 查询任务状态
            const task = await mongoose.connection.db
                .collection('hit_dlt_hwcpositivepredictiontasks')
                .findOne({ task_id: taskId });

            if (!task) {
                console.log('❌ 任务不存在');
                break;
            }

            const status = task.status;
            const progress = task.progress?.percentage || 0;

            process.stdout.write(`\r[${checkCount}/${maxChecks}] 任务状态: ${status} | 进度: ${progress}%   `);

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
                    console.log('⚠️ 这说明修复未生效或数据保存失败');
                    console.log('');
                    console.log('💡 排查建议:');
                    console.log('1. 检查服务器日志，是否有保存失败的错误');
                    console.log('2. 确认应用是否真的重启了');
                    console.log('3. 检查数据库写入权限');
                } else {
                    console.log('🎉 修复已生效！找到排除详情记录！\n');

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

                    console.log('按Step分组统计:');
                    console.log('┌───────────────┬────────────┬──────────────┬──────────────┬────────────┐');
                    console.log('│  Step         │ 记录数     │ 排除组合数   │ 有detailsMap │  期号数    │');
                    console.log('├───────────────┼────────────┼──────────────┼──────────────┼────────────┤');

                    for (let step = 2; step <= 10; step++) {
                        const stats = stepStats[step];
                        const stepName = getStepName(step);
                        const hasDetailsMapStr = stats.hasDetailsMap > 0 ? '✅ 有' : '❌ 无';

                        console.log(`│ ${step.toString().padStart(2)} - ${stepName.padEnd(9)} │ ${stats.recordCount.toString().padEnd(10)} │ ${stats.totalExcluded.toString().padEnd(12)} │ ${hasDetailsMapStr.padEnd(12)} │ ${stats.periods.size.toString().padEnd(10)} │`);
                    }
                    console.log('└───────────────┴────────────┴──────────────┴──────────────┴────────────┘');

                    // 显示样例详细原因
                    console.log('\n📝 样例排除原因（Step 2-6）:');
                    for (let step = 2; step <= 6; step++) {
                        const stepRecords = exclusionRecords.filter(r => r.step === step);
                        if (stepRecords.length > 0 && stepRecords[0].exclusion_details_map) {
                            const mapKeys = Object.keys(stepRecords[0].exclusion_details_map);
                            if (mapKeys.length > 0) {
                                const firstKey = mapKeys[0];
                                const detail = stepRecords[0].exclusion_details_map[firstKey];
                                console.log(`   Step ${step} (${getStepName(step)}): ${detail.description || JSON.stringify(detail)}`);
                            }
                        }
                    }

                    console.log('\n✅ Sheet2现在应该能正常显示数据了！');
                    console.log('   请导出Excel验证。\n');
                }

                break;
            } else if (status === 'failed') {
                console.log('\n\n❌ 任务执行失败！');
                break;
            }

            // 等待5秒后继续检查
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        if (checkCount >= maxChecks) {
            console.log('\n\n⏰ 监控超时（5分钟）');
            console.log('   任务可能需要更长时间，请稍后手动检查');
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
