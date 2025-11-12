/**
 * 诊断热温冷正选任务的Sheet2排除详情问题
 * 检查数据库中是否有排除详情数据，以及数据的完整性
 */

const mongoose = require('mongoose');

// MongoDB连接
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

const DLTExclusionDetails = mongoose.model('DLTExclusionDetails', exclusionDetailsSchema);
const HwcPositiveTask = mongoose.model('HwcPositiveTask', hwcPositiveTaskSchema);

async function diagnose() {
    try {
        console.log('🔍 连接MongoDB...');
        await mongoose.connect(mongoUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 1. 查找最近的热温冷正选任务
        console.log('📋 查找最近的热温冷正选任务...');
        const recentTask = await HwcPositiveTask.findOne()
            .sort({ created_at: -1 })
            .lean();

        if (!recentTask) {
            console.log('❌ 未找到任何热温冷正选任务');
            process.exit(0);
        }

        console.log(`✅ 找到任务: ${recentTask.task_name || recentTask.task_id}`);
        console.log(`   任务ID: ${recentTask.task_id}`);
        console.log(`   状态: ${recentTask.status}`);
        console.log(`   期号数量: ${recentTask.processed_periods?.length || 0}`);
        console.log('');

        // 2. 检查该任务的所有排除详情记录
        console.log('🔍 检查排除详情数据...');
        const exclusionRecords = await DLTExclusionDetails.find({
            task_id: recentTask.task_id
        }).sort({ period: 1, step: 1, chunk_index: 1 }).lean();

        console.log(`📊 排除详情记录总数: ${exclusionRecords.length}`);

        if (exclusionRecords.length === 0) {
            console.log('❌ 该任务没有任何排除详情记录！');
            console.log('   这是问题的根本原因：数据未保存到数据库');
            process.exit(0);
        }

        // 3. 按Step分组统计
        console.log('\n📊 按Step分组统计:');
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

        // 打印统计结果
        console.log('\n┌─────────┬────────────┬──────────────┬──────────────┬────────────┐');
        console.log('│  Step   │ 记录数     │ 排除组合数   │ 有detailsMap │  期号数    │');
        console.log('├─────────┼────────────┼──────────────┼──────────────┼────────────┤');

        for (let step = 2; step <= 10; step++) {
            const stats = stepStats[step];
            const stepName = getStepName(step);
            const hasDetailsMapStr = stats.hasDetailsMap > 0 ? '✅ 有' : '❌ 无';

            console.log(`│ ${step.toString().padEnd(7)} │ ${stats.recordCount.toString().padEnd(10)} │ ${stats.totalExcluded.toString().padEnd(12)} │ ${hasDetailsMapStr.padEnd(12)} │ ${stats.periods.size.toString().padEnd(10)} │`);
        }
        console.log('└─────────┴────────────┴──────────────┴──────────────┴────────────┘');

        // 4. 详细检查Step 7-10的数据（Sheet2应该显示的数据）
        console.log('\n🔍 详细检查Step 7-10的数据（Sheet2应该显示）:');
        for (let step = 7; step <= 10; step++) {
            const stepRecords = exclusionRecords.filter(r => r.step === step);
            if (stepRecords.length === 0) {
                console.log(`\n❌ Step ${step} (${getStepName(step)}): 无数据`);
                continue;
            }

            console.log(`\n✅ Step ${step} (${getStepName(step)}):`);
            console.log(`   记录数: ${stepRecords.length}`);
            console.log(`   总排除: ${stepRecords.reduce((sum, r) => sum + (r.excluded_count || 0), 0)} 个组合`);

            // 检查第一条记录的detailsMap
            const firstRecord = stepRecords[0];
            if (firstRecord.exclusion_details_map) {
                const mapSize = Object.keys(firstRecord.exclusion_details_map).length;
                console.log(`   detailsMap: ✅ 有数据 (${mapSize} 个条目)`);

                // 显示一个样例
                const sampleId = Object.keys(firstRecord.exclusion_details_map)[0];
                const sampleDetail = firstRecord.exclusion_details_map[sampleId];
                console.log(`   样例: ID=${sampleId}`, sampleDetail);
            } else {
                console.log(`   detailsMap: ❌ 无数据`);
            }
        }

        // 5. 检查Step 2-6的数据（未在Sheet2显示的数据）
        console.log('\n🔍 检查Step 2-6的数据（未在Sheet2显示）:');
        for (let step = 2; step <= 6; step++) {
            const stepRecords = exclusionRecords.filter(r => r.step === step);
            if (stepRecords.length === 0) {
                console.log(`\n❌ Step ${step} (${getStepName(step)}): 无数据`);
                continue;
            }

            console.log(`\n✅ Step ${step} (${getStepName(step)}):`);
            console.log(`   记录数: ${stepRecords.length}`);
            console.log(`   总排除: ${stepRecords.reduce((sum, r) => sum + (r.excluded_count || 0), 0)} 个组合`);

            // 检查第一条记录的detailsMap
            const firstRecord = stepRecords[0];
            if (firstRecord.exclusion_details_map && Object.keys(firstRecord.exclusion_details_map).length > 0) {
                const mapSize = Object.keys(firstRecord.exclusion_details_map).length;
                console.log(`   detailsMap: ✅ 有数据 (${mapSize} 个条目)`);
            } else {
                console.log(`   detailsMap: ❌ 无数据（这是正常的，Step 2-6不记录详细原因）`);
            }
        }

        // 6. 检查具体某个期号的数据
        if (recentTask.processed_periods && recentTask.processed_periods.length > 0) {
            const samplePeriod = recentTask.processed_periods[0];
            console.log(`\n🔍 检查样例期号 ${samplePeriod} 的数据:`);

            const periodRecords = await DLTExclusionDetails.find({
                task_id: recentTask.task_id,
                period: samplePeriod.toString()
            }).sort({ step: 1 }).lean();

            console.log(`   该期号的排除详情记录数: ${periodRecords.length}`);

            const step7to10Records = periodRecords.filter(r => r.step >= 7 && r.step <= 10);
            console.log(`   其中Step 7-10的记录: ${step7to10Records.length} 条`);

            if (step7to10Records.length > 0) {
                console.log('   ✅ Sheet2应该能显示数据');
            } else {
                console.log('   ❌ Sheet2无法显示数据（缺少Step 7-10记录）');
            }
        }

        // 7. 总结问题
        console.log('\n' + '='.repeat(60));
        console.log('📋 诊断总结:');
        console.log('='.repeat(60));

        const hasStep7to10Data = exclusionRecords.some(r => r.step >= 7 && r.step <= 10);

        if (!hasStep7to10Data) {
            console.log('❌ 问题确认: 数据库中没有Step 7-10的排除详情');
            console.log('   原因: 任务执行时没有保存Step 7-10的排除详情');
            console.log('   影响: Sheet2无法显示任何数据');
        } else {
            console.log('✅ 数据库中有Step 7-10的排除详情');
            console.log('   如果Sheet2仍然没有数据，可能的原因:');
            console.log('   1. 导出时查询条件错误');
            console.log('   2. 任务ID或期号不匹配');
            console.log('   3. 异步保存时序问题（数据未就绪就开始导出）');
        }

        console.log('');

    } catch (error) {
        console.error('❌ 诊断失败:', error);
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

diagnose().catch(console.error);
