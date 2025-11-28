const mongoose = require('mongoose');

async function diagnoseHWCTaskIssue() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🔍 开始诊断热温冷正选任务问题...\n');

    // 1. 检查数据库中的期号
    const HIT_DLT = mongoose.model('HIT_DLT', new mongoose.Schema({
        Issue: Number,
        DrawDate: Date,
        WinningNumbers: String
    }), 'hit_dlts');

    // 检查 25115-25125 范围内的期号
    const issues = await HIT_DLT.find({
        Issue: { $gte: 25115, $lte: 25125 }
    }).sort({ Issue: 1 });

    console.log('📊 数据库中的期号:');
    issues.forEach(issue => {
        console.log(`  - ${issue.Issue}: 存在 ✅`);
    });

    // 2. 检查最新期号
    const latestIssue = await HIT_DLT.findOne().sort({ Issue: -1 });
    console.log(`\n🎯 最新期号: ${latestIssue.Issue}`);

    // 3. 检查热温冷优化表
    const HWCOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'HIT_DLT_RedCombinationsHotWarmColdOptimized'
    );

    // 查询几个关键期号对的热温冷数据
    const testPairs = [
        { base: 25114, target: 25115 },
        { base: 25116, target: 25117 },
        { base: 25123, target: 25124 }
    ];

    console.log('\n🔥 热温冷优化表数据检查:');
    for (const pair of testPairs) {
        const hwcData = await HWCOptimized.findOne({
            base_issue: pair.base,
            target_issue: pair.target
        });

        if (hwcData) {
            console.log(`  ✅ ${pair.base} → ${pair.target}: 有数据`);
        } else {
            console.log(`  ❌ ${pair.base} → ${pair.target}: 无数据`);
        }
    }

    // 4. 检查最新的热温冷正选任务结果
    const TaskResult = mongoose.model('HIT_DLT_HwcPositivePredictionTaskResult',
        new mongoose.Schema({
            task_id: String,
            period: Number,
            is_predicted: Boolean,
            red_combinations: Array,
            combination_count: Number
        }),
        'HIT_DLT_HwcPositivePredictionTaskResults'
    );

    const latestResults = await TaskResult.find({
        period: { $gte: 25115, $lte: 25125 }
    }).sort({ created_at: -1 }).limit(20);

    console.log('\n📋 任务结果数据:');
    const periodGroups = {};
    latestResults.forEach(result => {
        if (!periodGroups[result.period]) {
            periodGroups[result.period] = [];
        }
        periodGroups[result.period].push(result);
    });

    Object.keys(periodGroups).sort().forEach(period => {
        const results = periodGroups[period];
        console.log(`\n期号 ${period}:`);
        results.forEach(result => {
            console.log(`  - 任务: ${result.task_id}`);
            console.log(`    is_predicted: ${result.is_predicted}`);
            console.log(`    组合数: ${result.red_combinations ? result.red_combinations.length : 0}`);
        });
    });

    await mongoose.connection.close();
}

diagnoseHWCTaskIssue().catch(console.error);