const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function fixHWCTaskResultGeneration() {
    console.log('🔧 修复热温冷任务结果生成逻辑 ...\n');

    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    mongoose.set('strictQuery', false);  // 禁用严格查询模式

    // 1. 检查并修复任务结果模型定义
    console.log('📝 检查任务结果模型定义');

    const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf-8');

    const taskResultModelDefinition = serverContent.match(/mongoose\.model\(['"]HIT_DLT_HwcPositivePredictionTaskResult['"][^)]+\)/);

    if (taskResultModelDefinition) {
        console.log('  ✅ 找到任务结果模型定义');

        // 检查模型定义是否完整
        if (!taskResultModelDefinition[0].includes('strict: false')) {
            console.log('  🔧 修复模型定义：添加 strict: false');
            serverContent = serverContent.replace(
                taskResultModelDefinition[0],
                taskResultModelDefinition[0].replace(')', ', { strict: false })')
            );

            fs.writeFileSync(serverPath, serverContent, 'utf-8');
            console.log('  ✅ 已更新服务器代码');
        }
    }

    // 2. 修复任务结果记录
    const TaskResult = mongoose.models['HIT_DLT_HwcPositivePredictionTaskResult']
        || mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult',
            new mongoose.Schema({}, { strict: false }),
            'hit_dlt_hwcpositivepredictiontaskresults'
        );

    console.log('\n🔍 检查并修复任务结果记录');

    const problematicResults = await TaskResult.find({
        $or: [
            { period: { $exists: false } },
            { period_range: { $exists: false } },
            { combination_count: 0 }
        ]
    }).limit(10);

    console.log(`  发现 ${problematicResults.length} 个有问题的记录`);

    for (const result of problematicResults) {
        console.log(`\n  修复记录: ${result.result_id}`);

        // 尝试从任务中恢复期号信息
        const Task = mongoose.models['HIT_DLT_HwcPositivePredictionTask']
            || mongoose.model('HIT_DLT_HwcPositivePredictionTask',
                new mongoose.Schema({}, { strict: false }),
                'hit_dlt_hwcpositivepredictiontasks'
            );

        const relatedTask = await Task.findOne({ task_id: result.task_id });

        if (relatedTask && relatedTask.period_range) {
            console.log('    - 从任务中恢复期号范围');

            // 使用热温冷优化数据补充组合
            const HWCOptimized = mongoose.models['HIT_DLT_RedCombinationsHotWarmColdOptimized']
                || mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
                    new mongoose.Schema({}, { strict: false }),
                    'hit_dlt_redcombinationshotwarmcoldoptimizeds'
                );

            const hwcData = await HWCOptimized.findOne({
                base_issue: relatedTask.period_range.start,
                target_issue: result.result_id.split('-').pop()
            });

            if (hwcData) {
                console.log('    - 找到HWC数据，补充组合');

                // 选择第一个比例的组合
                const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
                if (ratios.length > 0) {
                    const firstRatio = ratios[0];
                    const combinations = hwcData.hot_warm_cold_data[firstRatio] || [];

                    result.red_combinations = combinations.slice(0, 10);  // 限制为前10个组合
                    result.combination_count = combinations.length;
                    result.period = result.result_id.split('-').pop();
                    result.period_range = relatedTask.period_range;

                    await result.save();
                    console.log(`    ✅ 已更新记录，组合数: ${result.combination_count}`);
                }
            }
        }
    }

    // 3. 统计修复情况
    const updatedResultsCount = await TaskResult.countDocuments({
        combination_count: { $gt: 0 }
    });

    console.log(`\n✅ 修复完成`);
    console.log(`   总记录数: ${await TaskResult.countDocuments()}`);
    console.log(`   有组合数据的记录: ${updatedResultsCount}`);

    await mongoose.connection.close();
}

fixHWCTaskResultGeneration().catch(console.error);