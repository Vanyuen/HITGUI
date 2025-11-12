/**
 * 检查任务的排除详情数据
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

async function checkExclusionDetails() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        const taskId = 'hwc-pos-20251111-gqb';

        // 检查排除详情集合
        console.log(`🔍 查找排除详情...`);

        const exclusionRecords = await mongoose.connection.db
            .collection('HIT_DLT_ExclusionDetails')
            .find({ task_id: taskId })
            .toArray();

        console.log(`📊 排除详情记录总数: ${exclusionRecords.length}\n`);

        if (exclusionRecords.length === 0) {
            console.log('❌ 该任务没有任何排除详情记录！');
            console.log('');
            console.log('这就是Sheet2没有数据的根本原因！');
            console.log('');
            console.log('可能的原因:');
            console.log('1. ⚠️ 任务是在修复前创建的（应用还在使用旧代码）');
            console.log('2. ⚠️ 排除详情保存失败');
            console.log('3. ⚠️ 数据库写入权限问题');
            console.log('');
            console.log('💡 解决方案:');
            console.log('1. 确认应用已使用修复后的代码重启');
            console.log('2. 删除该任务，重新创建一个新任务');
            console.log('3. 观察新任务执行日志，确认看到"排除详情保存完成"的消息');
        } else {
            console.log('✅ 找到排除详情记录\n');

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

            // 显示样例数据
            if (exclusionRecords.length > 0) {
                console.log('\n样例数据（第一条记录）:');
                const sample = exclusionRecords[0];
                console.log(`   Step: ${sample.step} (${getStepName(sample.step)})`);
                console.log(`   期号: ${sample.period}`);
                console.log(`   排除数量: ${sample.excluded_count}`);
                console.log(`   有detailsMap: ${sample.exclusion_details_map ? '✅ 是' : '❌ 否'}`);

                if (sample.exclusion_details_map) {
                    const mapKeys = Object.keys(sample.exclusion_details_map);
                    console.log(`   detailsMap条目数: ${mapKeys.length}`);

                    if (mapKeys.length > 0) {
                        const firstKey = mapKeys[0];
                        const firstDetail = sample.exclusion_details_map[firstKey];
                        console.log(`   样例详情:`, JSON.stringify(firstDetail, null, 4));
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
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

checkExclusionDetails().catch(console.error);
