const mongoose = require('mongoose');

async function deepDiagnosisLatestTask() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    mongoose.set('strictQuery', false);

    console.log('🔍 深度诊断最新热温冷任务处理逻辑...\n');

    // 1. 获取最新任务
    const Task = mongoose.model('HIT_DLT_HwcPositivePredictionTask',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_hwcpositivepredictiontasks'
    );

    const latestTask = await Task.findOne().sort({ created_at: -1 });
    if (!latestTask) {
        console.log('❌ 未找到任务');
        await mongoose.connection.close();
        return;
    }

    console.log('📋 最新任务信息:');
    console.log(`  - 任务ID: ${latestTask.task_id}`);
    console.log(`  - 期号范围: ${JSON.stringify(latestTask.period_range)}`);
    console.log(`  - 热温冷比: ${JSON.stringify(latestTask.positive_selection?.red_hot_warm_cold_ratios)}`);
    console.log(`  - 状态: ${latestTask.status}`);
    console.log(`  - 配对模式: ${latestTask.output_config?.pairingMode}`);

    // 2. 获取任务结果
    const TaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_hwcpositivepredictiontaskresults'
    );

    const results = await TaskResult.find({ task_id: latestTask.task_id })
        .sort({ period: 1 });

    console.log(`\n📊 任务结果 (${results.length}条):`);
    for (const result of results) {
        console.log(`\n期号 ${result.period} (${result.is_predicted ? '推算' : '历史'}):`);
        console.log(`  - 红球组合数: ${result.red_combinations?.length || 0}`);
        console.log(`  - 蓝球组合数: ${result.blue_combinations?.length || 0}`);
        console.log(`  - 配对组合数: ${result.combination_count || 0}`);
        console.log(`  - 配对模式: ${result.pairing_mode}`);

        if (result.positive_selection_details) {
            const details = result.positive_selection_details;
            console.log(`  - 正选详情:`);
            console.log(`    • Step1 基础组合: ${details.step1_base_combination_ids?.length || 0}`);
            console.log(`    • Step2 区间比: ${details.step2_zone_filtered_count || 'N/A'}`);
            console.log(`    • Step3 和值: ${details.step3_sum_filtered_count || 'N/A'}`);
        }

        if (result.exclusion_summary) {
            console.log(`  - 排除统计:`);
            console.log(`    • HWC排除: ${result.exclusion_summary.hwc_exclude_count || 0}`);
            console.log(`    • 和值排除: ${result.exclusion_summary.sum_exclude_count || 0}`);
            console.log(`    • 跨度排除: ${result.exclusion_summary.span_exclude_count || 0}`);
        }
    }

    // 3. 检查HWC优化数据是否被正确查询
    console.log('\n🔍 检查HWC优化数据查询...');

    const HWCOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 注意使用正确的集合名
    );

    // 测试查询几个关键期号对
    const testPairs = [
        { base: '25120', target: '25121' },
        { base: '25121', target: '25122' },
        { base: '25122', target: '25123' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    console.log('\nHWC优化数据查询测试:');
    for (const pair of testPairs) {
        const hwcData = await HWCOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        });

        if (hwcData) {
            // 检查是否有任务所需的热温冷比
            const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
            const taskRatios = latestTask.positive_selection?.red_hot_warm_cold_ratios || [];

            console.log(`\n  ${pair.base} → ${pair.target}:`);
            console.log(`    ✅ 数据存在`);
            console.log(`    - 可用比例 (${ratios.length}): ${ratios.slice(0, 5).join(', ')}...`);

            // 检查任务所需的比例
            for (const taskRatio of taskRatios) {
                const ratioKey = typeof taskRatio === 'string'
                    ? taskRatio
                    : `${taskRatio.hot}:${taskRatio.warm}:${taskRatio.cold}`;

                const comboCount = hwcData.hot_warm_cold_data[ratioKey]?.length || 0;
                console.log(`    - ${ratioKey}: ${comboCount}个组合`);
            }
        } else {
            console.log(`\n  ${pair.base} → ${pair.target}:`);
            console.log(`    ❌ 数据不存在`);
        }
    }

    // 4. 检查期号ID映射
    console.log('\n🔍 检查期号ID映射...');

    const HIT_DLT = mongoose.model('HIT_DLT',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlts'
    );

    const testIssues = ['25120', '25121', '25122', '25123', '25124', '25125'];
    console.log('期号ID映射:');
    for (const issue of testIssues) {
        const record = await HIT_DLT.findOne({ Issue: parseInt(issue) });
        if (record) {
            console.log(`  ${issue} → ID: ${record.ID || '无ID字段'}`);
        } else {
            console.log(`  ${issue} → ❌ 不存在（应为推算期）`);
        }
    }

    // 5. 分析0组合的原因
    console.log('\n🔍 分析组合数为0的原因...');

    const zeroComboResults = results.filter(r => r.combination_count === 0);
    console.log(`\n找到${zeroComboResults.length}个组合数为0的结果:`);

    for (const result of zeroComboResults) {
        console.log(`\n期号 ${result.period}:`);
        console.log(`  - 红球组合: ${result.red_combinations?.length || 0}`);
        console.log(`  - 蓝球组合: ${result.blue_combinations?.length || 0}`);

        // 检查是否有正选详情
        if (result.positive_selection_details) {
            const details = result.positive_selection_details;
            console.log(`  - 正选步骤:`);
            console.log(`    • Step1基础组合: ${details.step1_base_combination_ids?.length || 0}`);

            if (details.step1_base_combination_ids && details.step1_base_combination_ids.length === 0) {
                console.log(`  ⚠️ 问题: Step1热温冷筛选就没有组合！`);
                console.log(`  可能原因:`);
                console.log(`    1. HWC优化数据未被正确查询`);
                console.log(`    2. 期号对映射错误`);
                console.log(`    3. 所选热温冷比在该期号对无匹配组合`);
            }
        } else {
            console.log(`  ⚠️ 缺少正选详情数据`);
        }
    }

    // 6. 检查最新数据库集合名
    console.log('\n🔍 检查数据库集合名...');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const hwcCollections = collections.filter(c =>
        c.name.toLowerCase().includes('hotwarmcold') ||
        c.name.toLowerCase().includes('hwc')
    );

    console.log('HWC相关集合:');
    for (const col of hwcCollections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  - ${col.name}: ${count}条记录`);
    }

    await mongoose.connection.close();
}

deepDiagnosisLatestTask().catch(console.error);