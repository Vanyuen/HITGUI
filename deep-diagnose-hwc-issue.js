const mongoose = require('mongoose');

async function deepDiagnoseHWCIssue() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    console.log('🔍 深入诊断热温冷数据问题...\n');

    // 1. 检查热温冷优化表的总数据量
    const HWCOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'HIT_DLT_RedCombinationsHotWarmColdOptimized'
    );

    const totalCount = await HWCOptimized.countDocuments();
    console.log(`📊 热温冷优化表总记录数: ${totalCount}`);

    // 2. 检查具体的期号对数据
    const sampleData = await HWCOptimized.find().limit(5);
    console.log('\n📋 样本数据:');
    sampleData.forEach(data => {
        console.log(`  - base_issue: ${data.base_issue}, target_issue: ${data.target_issue}`);
    });

    // 3. 检查特定期号的数据（使用不同的查询方式）
    console.log('\n🔍 检查关键期号数据:');

    // 直接查询所有25116相关的数据
    const data25116 = await HWCOptimized.find({
        $or: [
            { base_issue: 25116 },
            { target_issue: 25117 }
        ]
    }).limit(10);

    console.log(`\n25116/25117 相关数据 (找到 ${data25116.length} 条):`);
    data25116.forEach(d => {
        console.log(`  - base: ${d.base_issue}, target: ${d.target_issue}`);
    });

    // 4. 检查期号ID映射
    const HIT_DLT = mongoose.model('HIT_DLT', new mongoose.Schema({
        Issue: Number,
        ID: Number
    }), 'hit_dlts');

    const issuesWithID = await HIT_DLT.find({
        Issue: { $gte: 25115, $lte: 25125 }
    }).select('Issue ID').sort({ Issue: 1 });

    console.log('\n🔢 期号-ID映射:');
    issuesWithID.forEach(issue => {
        console.log(`  - Issue ${issue.Issue} -> ID ${issue.ID || '无ID字段'}`);
    });

    // 5. 检查红球组合表
    const RedCombinations = mongoose.model('hit_dlt_redcombinations',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_redcombinations'
    );

    const redComboCount = await RedCombinations.countDocuments();
    console.log(`\n🔴 红球组合表总数: ${redComboCount}`);

    // 6. 检查任务处理日志
    console.log('\n📝 检查最新任务的处理情况:');

    const Task = mongoose.model('HIT_DLT_HwcPositivePredictionTask',
        new mongoose.Schema({
            task_id: String,
            period_range: Object,
            positive_selection: Object,
            status: String
        }),
        'HIT_DLT_HwcPositivePredictionTasks'
    );

    const latestTask = await Task.findOne().sort({ created_at: -1 });
    if (latestTask) {
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  期号范围: ${JSON.stringify(latestTask.period_range)}`);
        console.log(`  热温冷比: ${JSON.stringify(latestTask.positive_selection?.red_hot_warm_cold_ratios)}`);
        console.log(`  状态: ${latestTask.status}`);
    }

    await mongoose.connection.close();
}

deepDiagnoseHWCIssue().catch(console.error);