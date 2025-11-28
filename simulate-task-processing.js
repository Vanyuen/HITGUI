const mongoose = require('mongoose');

async function simulateTaskProcessing() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    mongoose.set('strictQuery', false);

    console.log('🔍 模拟任务处理流程...\n');

    // 1. 获取最新任务
    const Task = mongoose.model('HIT_DLT_HwcPositivePredictionTask',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_hwcpositivepredictiontasks'
    );

    const latestTask = await Task.findOne().sort({ created_at: -1 });
    console.log('📋 最新任务:');
    console.log(`  任务ID: ${latestTask.task_id}`);
    console.log(`  期号范围配置: ${JSON.stringify(latestTask.period_range)}`);

    // 2. 模拟期号范围解析
    const targetIssues = ['25121', '25122', '25123', '25124', '25125'];
    console.log(`\n📅 目标期号: ${targetIssues.join(', ')}`);

    // 3. 模拟期号对生成逻辑（复制server.js的逻辑）
    const HIT_DLT = mongoose.model('HIT_DLT',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlts'
    );

    const issueNumbers = targetIssues.map(i => parseInt(i));

    // 查询第一个期号的信息
    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await HIT_DLT.findOne({ Issue: firstIssueNum })
        .select('Issue ID')
        .lean();

    console.log(`\n🔍 第一个期号信息:`);
    console.log(`  期号: ${firstIssueRecord.Issue}`);
    console.log(`  ID: ${firstIssueRecord.ID}`);

    // 查询所有期号（包括第一个期号的上一期）
    const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
    const allRecords = await HIT_DLT.find({
        $or: [
            { ID: { $in: allIssueNums } },
            { Issue: { $in: issueNumbers } }
        ]
    })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`\n📊 查询到的所有记录:`);
    for (const record of allRecords) {
        console.log(`  Issue ${record.Issue} → ID ${record.ID}`);
    }

    // 构建ID→Record映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // 使用ID-1规则生成期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    const issuePairs = [];

    console.log(`\n🔧 生成期号对 (使用ID-1规则):`);
    for (const record of issueRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();

        // 查询ID-1对应的基准期记录
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: targetIssue
            });

            console.log(`  ✅ ${baseRecord.Issue} → ${targetIssue} (ID ${baseRecord.ID} → ${targetID})`);
        } else {
            console.log(`  ❌ ${targetIssue} (ID ${targetID}) 的上一期 (ID ${targetID - 1}) 不存在`);
        }
    }

    // 4. 检查HWC优化数据
    const HWCOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_redcombinationshotwarmcoldoptimizeds'
    );

    console.log(`\n🔍 检查HWC优化数据:`);
    for (const pair of issuePairs) {
        const hwcData = await HWCOptimized.findOne({
            base_issue: pair.base_issue,
            target_issue: pair.target_issue
        });

        if (hwcData) {
            const ratios = Object.keys(hwcData.hot_warm_cold_data || {});
            const ratio410Count = hwcData.hot_warm_cold_data['4:1:0']?.length || 0;
            console.log(`  ✅ ${pair.base_issue} → ${pair.target_issue}: 有数据, 4:1:0组合=${ratio410Count}`);
        } else {
            console.log(`  ❌ ${pair.base_issue} → ${pair.target_issue}: 无数据`);
        }
    }

    // 5. 分析问题原因
    console.log(`\n🔍 分析问题:`);
    console.log(`  1. 期号对生成逻辑: ${issuePairs.length === targetIssues.length ? '✅ 正常' : '❌ 有问题'}`);
    console.log(`  2. HWC数据可用性: ${issuePairs.length}个期号对都有数据`);
    console.log(`  3. 但为什么任务结果中Step1组合为0？`);

    console.log(`\n⚠️ 关键怀疑:`);
    console.log(`  任务配置的期号范围可能与实际处理的期号不一致！`);
    console.log(`  检查任务的 period_range.start 和 period_range.end:`);
    console.log(`    - start: ${latestTask.period_range.start}`);
    console.log(`    - end: ${latestTask.period_range.end}`);
    console.log(`    - 预期期号: ${targetIssues.join(', ')}`);

    await mongoose.connection.close();
}

simulateTaskProcessing().catch(console.error);