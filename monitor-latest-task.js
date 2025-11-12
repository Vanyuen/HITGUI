/**
 * 监控最新热温冷正选任务的排除详情
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

async function monitorLatestTask() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 查找最新的任务
        console.log('📋 查找最新创建的热温冷正选任务...');
        const latestTask = await mongoose.connection.db
            .collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();

        if (latestTask.length === 0) {
            console.log('❌ 未找到任何热温冷正选任务');
            console.log('💡 请先创建一个新任务');
            process.exit(0);
        }

        const task = latestTask[0];
        console.log(`✅ 找到最新任务: ${task.task_id}`);
        console.log(`   任务名称: ${task.task_name || '未命名'}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   状态: ${task.status}`);
        console.log('');

        // 检查这个任务的排除详情
        console.log(`🔍 检查任务 ${task.task_id} 的排除详情...`);

        const exclusionRecords = await mongoose.connection.db
            .collection('HIT_DLT_ExclusionDetails')
            .find({ task_id: task.task_id })
            .toArray();

        console.log(`📊 排除详情记录总数: ${exclusionRecords.length}\n`);

        if (exclusionRecords.length === 0) {
            console.log('❌ 该任务没有任何排除详情记录！\n');

            if (task.status === 'completed') {
                console.log('⚠️ 任务已完成但没有排除详情！');
                console.log('   这说明任务使用的是修复前的代码。\n');
                console.log('💡 解决方案:');
                console.log('   1. 确认应用已重启（使用修复后的代码）');
                console.log('   2. 删除这个任务');
                console.log('   3. 创建一个新任务');
            } else if (task.status === 'processing') {
                console.log('⏳ 任务正在执行中...');
                console.log('   请等待任务完成后再检查');
            } else {
                console.log(`📌 任务状态: ${task.status}`);
            }
        } else {
            console.log('✅ 找到排除详情记录！修复已生效！\n');

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
            console.log('┌─────────┬────────────┬──────────────┬──────────────┬────────────┐');
            console.log('│  Step   │ 记录数     │ 排除组合数   │ 有detailsMap │  期号数    │');
            console.log('├─────────┼────────────┼──────────────┼──────────────┼────────────┤');

            for (let step = 2; step <= 10; step++) {
                const stats = stepStats[step];
                const stepName = getStepName(step);
                const hasDetailsMapStr = stats.hasDetailsMap > 0 ? '✅ 有' : '❌ 无';

                console.log(`│ ${step} - ${stepName.padEnd(5)} │ ${stats.recordCount.toString().padEnd(10)} │ ${stats.totalExcluded.toString().padEnd(12)} │ ${hasDetailsMapStr.padEnd(12)} │ ${stats.periods.size.toString().padEnd(10)} │`);
            }
            console.log('└─────────┴────────────┴──────────────┴──────────────┴────────────┘');

            console.log('\n✅ Sheet2现在应该能显示数据了！');
            console.log('   请导出Excel验证。');
        }

        console.log('');

    } catch (error) {
        console.error('❌ 监控失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 数据库连接已关闭');
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

monitorLatestTask().catch(console.error);
