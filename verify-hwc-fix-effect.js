const mongoose = require('mongoose');

async function verifyHWCFix() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🔍 验证HWC集合名修复效果...\n');

    // 1. 测试直接查询修复后的模型
    console.log('📊 步骤1: 测试修复后的模型查询');

    // 使用修复后的模型定义（与server.js保持一致）
    const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed,
        total_combinations: Number
    }, { strict: false });

    // 使用正确的集合名
    const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
        'HIT_DLT_RedCombinationsHotWarmColdOptimizedFixed',
        dltRedCombinationsHotWarmColdOptimizedSchema,
        'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 正确的集合名
    );

    // 测试查询
    const testPairs = [
        { base: '25114', target: '25115' },
        { base: '25115', target: '25116' },
        { base: '25116', target: '25117' },
        { base: '25123', target: '25124' },
        { base: '25124', target: '25125' }
    ];

    console.log('测试查询关键期号对:');
    for (const pair of testPairs) {
        const data = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        });

        if (data) {
            // 检查4:1:0比例的组合数
            const ratio410Count = data.hot_warm_cold_data?.['4:1:0']?.length || 0;
            console.log(`  ✅ ${pair.base} → ${pair.target}: 有数据, 4:1:0组合数=${ratio410Count}`);
        } else {
            console.log(`  ❌ ${pair.base} → ${pair.target}: 无数据`);
        }
    }

    // 2. 模拟服务器查询逻辑
    console.log('\n📊 步骤2: 模拟服务器查询逻辑');

    const baseIssue = '25115';
    const targetIssue = '25116';
    const hwcRatio = { hot: 4, warm: 1, cold: 0 };
    const ratioKey = `${hwcRatio.hot}:${hwcRatio.warm}:${hwcRatio.cold}`;

    console.log(`查询: base=${baseIssue}, target=${targetIssue}, ratio=${ratioKey}`);

    const hwcData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
    });

    if (hwcData && hwcData.hot_warm_cold_data) {
        const combinationIds = hwcData.hot_warm_cold_data[ratioKey] || [];
        console.log(`  ✅ 找到HWC数据`);
        console.log(`  - 总比例数: ${Object.keys(hwcData.hot_warm_cold_data).length}`);
        console.log(`  - ${ratioKey}组合数: ${combinationIds.length}`);

        if (combinationIds.length > 0) {
            console.log(`  - 前5个组合ID: ${combinationIds.slice(0, 5).join(', ')}...`);
        }
    } else {
        console.log(`  ❌ 未找到HWC数据`);
    }

    // 3. 检查是否还有使用错误集合名的查询
    console.log('\n📊 步骤3: 检查错误集合名是否有数据');

    try {
        const WrongModel = mongoose.model(
            'HIT_DLT_RedCombinationsHotWarmColdOptimizedWrong',
            dltRedCombinationsHotWarmColdOptimizedSchema,
            'hit_dlt_redcombinationshotwarmcoldoptimized'  // 错误的集合名（单数）
        );

        const wrongCount = await WrongModel.countDocuments();
        console.log(`  错误集合(单数形式): ${wrongCount} 条记录`);
    } catch (err) {
        console.log(`  错误集合不存在或无法访问`);
    }

    // 4. 验证期号判断
    console.log('\n📊 步骤4: 验证期号判断逻辑');

    const HIT_DLT = mongoose.model('HIT_DLT',
        new mongoose.Schema({ Issue: Number }),
        'hit_dlts'
    );

    const latestIssue = await HIT_DLT.findOne().sort({ Issue: -1 });
    console.log(`  最新开奖期号: ${latestIssue.Issue}`);

    // 检查25115是否存在
    const issue25115 = await HIT_DLT.findOne({ Issue: 25115 });
    console.log(`  期号25115: ${issue25115 ? '✅ 存在(历史期)' : '❌ 不存在'}`);

    // 检查25125是否存在
    const issue25125 = await HIT_DLT.findOne({ Issue: 25125 });
    console.log(`  期号25125: ${issue25125 ? '✅ 存在' : '❌ 不存在(应为推算期)'}`);

    console.log('\n✅ 验证完成！');

    await mongoose.connection.close();
}

verifyHWCFix().catch(console.error);