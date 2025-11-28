const mongoose = require('mongoose');

async function verifyHWCDataAndProblem() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🔍 验证HWC数据和问题根源...\n');

    // 1. 确认HWC数据存在的位置
    console.log('📊 热温冷优化数据实际位置:');
    console.log('  集合名: hit_dlt_redcombinationshotwarmcoldoptimizeds (复数形式)');

    const HWCOptimized = mongoose.model('hit_dlt_redcombinationshotwarmcoldoptimizeds',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 注意是复数形式
    );

    const totalCount = await HWCOptimized.countDocuments();
    console.log(`  总记录数: ${totalCount}`);

    // 2. 检查关键期号的HWC数据
    console.log('\n🔥 检查关键期号的HWC数据:');
    const testPairs = [
        { base: '25114', target: '25115' },
        { base: '25115', target: '25116' },
        { base: '25116', target: '25117' },
        { base: '25117', target: '25118' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    for (const pair of testPairs) {
        // 尝试多种查询方式
        let hwcData = await HWCOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        });

        if (!hwcData) {
            // 尝试数字格式
            hwcData = await HWCOptimized.findOne({
                base_issue: parseInt(pair.base),
                target_issue: parseInt(pair.target)
            });
        }

        if (hwcData) {
            const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
            console.log(`  ✅ ${pair.base} → ${pair.target}: 有数据 (包含 ${ratios.length} 种比例)`);

            // 显示一些比例样本
            if (ratios.length > 0) {
                console.log(`     比例样本: ${ratios.slice(0, 5).join(', ')}...`);

                // 检查是否有4:1:0比例（任务中设置的）
                if (hwcData.hot_warm_cold_data['4:1:0']) {
                    const count = hwcData.hot_warm_cold_data['4:1:0'].length;
                    console.log(`     ✅ 包含4:1:0比例，有 ${count} 个组合`);
                }
            }
        } else {
            console.log(`  ❌ ${pair.base} → ${pair.target}: 无数据`);
        }
    }

    // 3. 检查服务器代码中使用的集合名
    console.log('\n🔍 检查服务器代码中的集合名配置:');
    console.log('  需要确认 server.js 中是否使用了正确的集合名');
    console.log('  正确: hit_dlt_redcombinationshotwarmcoldoptimizeds (复数)');
    console.log('  错误: HIT_DLT_RedCombinationsHotWarmColdOptimized (单数)');

    // 4. 检查任务结果中的问题
    console.log('\n📋 检查任务结果中的问题:');
    const TaskResult = mongoose.model('hit_dlt_hwcpositivepredictiontaskresults',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_hwcpositivepredictiontaskresults'
    );

    const problemResults = await TaskResult.find({
        period: { $gte: 25115, $lte: 25124 },
        combination_count: 0
    }).limit(5);

    console.log(`  找到 ${problemResults.length} 个0组合的结果:`);
    problemResults.forEach(result => {
        console.log(`    - 期号 ${result.period}: is_predicted=${result.is_predicted}, 组合数=${result.combination_count}`);
        if (result.positive_selection_details) {
            console.log(`      step1基础组合: ${result.positive_selection_details.step1_base_combination_ids?.length || 0}`);
        }
    });

    // 5. 验证期号25115的is_predicted问题
    console.log('\n⚠️ 期号25115的is_predicted问题:');
    const result25115 = await TaskResult.findOne({ period: 25115 });
    if (result25115) {
        console.log(`  期号25115的is_predicted标记: ${result25115.is_predicted}`);
        console.log(`  应该是: false (因为25115是历史期号)`);
    }

    // 6. 最新期号检查
    const HIT_DLT = mongoose.model('HIT_DLT',
        new mongoose.Schema({ Issue: Number }),
        'hit_dlts'
    );

    const latestIssue = await HIT_DLT.findOne().sort({ Issue: -1 });
    console.log(`\n📅 数据库最新期号: ${latestIssue.Issue}`);
    console.log('  说明: 25115-25124都是历史期号，25125是预测期号');

    await mongoose.connection.close();
}

verifyHWCDataAndProblem().catch(console.error);