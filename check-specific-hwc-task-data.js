/**
 * 检查特定热温冷正选任务的数据
 */

const mongoose = require('mongoose');

const mongoUrl = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const exclusionDetailsSchema = new mongoose.Schema({
    task_id: String,
    result_id: String,
    period: String,
    step: Number,
    condition: String,
    excluded_combination_ids: [Number],
    excluded_count: Number,
    exclusion_details_map: mongoose.Schema.Types.Mixed,
    is_partial: Boolean,
    chunk_index: Number,
    total_chunks: Number
}, { collection: 'HIT_DLT_ExclusionDetails' });

const hwcPositiveTaskSchema = new mongoose.Schema({}, {
    collection: 'HIT_DLT_HwcPositivePredictionTasks',
    strict: false
});

const hwcPositiveResultSchema = new mongoose.Schema({}, {
    collection: 'HIT_DLT_HwcPositivePredictionTaskResults',
    strict: false
});

const DLTExclusionDetails = mongoose.model('DLTExclusionDetails', exclusionDetailsSchema);
const HwcPositiveTask = mongoose.model('HwcPositiveTask', hwcPositiveTaskSchema);
const HwcPositiveResult = mongoose.model('HwcPositiveResult', hwcPositiveResultSchema);

async function checkTask() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        const taskId = 'hwc-pos-20251111-gqb';

        // 1. 查找任务信息
        console.log(`📋 查找任务: ${taskId}...`);
        const task = await HwcPositiveTask.findOne({ task_id: taskId }).lean();

        if (!task) {
            console.log('❌ 未找到该任务');
            process.exit(0);
        }

        console.log(`✅ 找到任务: ${task.task_name || taskId}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   创建时间: ${task.created_at}`);
        console.log(`   处理期号数: ${task.processed_periods?.length || 0}`);
        if (task.processed_periods && task.processed_periods.length > 0) {
            console.log(`   期号列表: ${task.processed_periods.slice(0, 5).join(', ')}${task.processed_periods.length > 5 ? '...' : ''}`);
        }
        console.log('');

        // 2. 查找任务结果
        console.log(`📊 查找任务结果...`);
        const results = await HwcPositiveResult.find({ task_id: taskId }).lean();
        console.log(`   结果数量: ${results.length}`);

        if (results.length > 0) {
            const firstResult = results[0];
            console.log(`   样例结果ID: ${firstResult.result_id}`);
            console.log(`   样例期号: ${firstResult.period || firstResult.target_issue}`);
            console.log(`   配对组合数: ${firstResult.paired_combinations?.length || 0}`);
        }
        console.log('');

        // 3. 查找排除详情
        console.log(`🔍 查找排除详情...`);
        const exclusionRecords = await DLTExclusionDetails.find({ task_id: taskId }).lean();
        console.log(`   排除详情记录总数: ${exclusionRecords.length}`);

        if (exclusionRecords.length === 0) {
            console.log('   ❌ 该任务没有任何排除详情记录！');
            console.log('   ⚠️ 这就是Sheet2没有数据的原因！');
            console.log('');
            console.log('可能的原因:');
            console.log('1. 任务使用旧版本代码执行（修复前）');
            console.log('2. 排除详情保存失败');
            console.log('3. 数据库写入权限问题');
            console.log('');
            console.log('💡 建议: 删除该任务，重新创建一个新任务');
        } else {
            console.log('   ✅ 找到排除详情记录\n');

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

            console.log('   按Step分组统计:');
            console.log('   ┌─────────┬────────────┬──────────────┬──────────────┬────────────┐');
            console.log('   │  Step   │ 记录数     │ 排除组合数   │ 有detailsMap │  期号数    │');
            console.log('   ├─────────┼────────────┼──────────────┼──────────────┼────────────┤');

            for (let step = 2; step <= 10; step++) {
                const stats = stepStats[step];
                const stepName = getStepName(step);
                const hasDetailsMapStr = stats.hasDetailsMap > 0 ? '✅ 有' : '❌ 无';

                console.log(`   │ ${step.toString().padEnd(7)} │ ${stats.recordCount.toString().padEnd(10)} │ ${stats.totalExcluded.toString().padEnd(12)} │ ${hasDetailsMapStr.padEnd(12)} │ ${stats.periods.size.toString().padEnd(10)} │`);
            }
            console.log('   └─────────┴────────────┴──────────────┴──────────────┴────────────┘');

            // 检查样例数据
            const samplePeriod = task.processed_periods ? task.processed_periods[0] : null;
            if (samplePeriod) {
                console.log(`\n   🔍 检查样例期号 ${samplePeriod} 的数据:`);

                const periodRecords = await DLTExclusionDetails.find({
                    task_id: taskId,
                    period: samplePeriod.toString()
                }).sort({ step: 1 }).lean();

                console.log(`      该期号的排除详情记录数: ${periodRecords.length}`);

                if (periodRecords.length > 0) {
                    console.log('      分步详情:');
                    for (const record of periodRecords) {
                        const hasMap = record.exclusion_details_map && Object.keys(record.exclusion_details_map).length > 0;
                        console.log(`         Step ${record.step}: ${record.excluded_count} 个组合, detailsMap: ${hasMap ? '✅' : '❌'}`);
                    }
                } else {
                    console.log('      ❌ 该期号没有排除详情记录');
                }
            }
        }

        console.log('');

    } catch (error) {
        console.error('❌ 检查失败:', error);
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

checkTask().catch(console.error);
