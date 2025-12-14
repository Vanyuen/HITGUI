/**
 * 测试HWC预加载查询的类型问题
 */
const mongoose = require('mongoose');

async function testHwcQueryTypes() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_TypeTest', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    const dltSchema = new mongoose.Schema({}, { strict: false });
    const hit_dlts = mongoose.model('DLT_TypeTest', dltSchema, 'hit_dlts');

    console.log('=== 测试HWC查询类型 ===\n');

    // 1. 模拟preloadDataForIssues中的issuePairs构建
    console.log('=== 模拟issuePairs构建 ===');

    const targetRecords = await hit_dlts.find({ Issue: { $in: [25090, 25091, 25092] } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log('targetRecords:');
    for (const r of targetRecords) {
        console.log(`  Issue: ${r.Issue} (${typeof r.Issue}), ID: ${r.ID} (${typeof r.ID})`);
    }

    // 构建ID -> Record映射
    const idToRecordMap = new Map(targetRecords.map(r => [r.ID, r]));

    // 模拟issuePairs构建
    const issuePairs = [];
    for (const record of targetRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: targetIssue
            });
        }
    }

    console.log('\nissuePairs:');
    for (const p of issuePairs) {
        console.log(`  base: ${p.base_issue} (${typeof p.base_issue}), target: ${p.target_issue} (${typeof p.target_issue})`);
    }

    // 2. 模拟preloadHwcOptimizedData中的查询
    console.log('\n=== 测试preloadHwcOptimizedData查询 ===');

    const hwcDataList = await HwcOptimized.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();

    console.log(`查询结果数量: ${hwcDataList.length} (期望: ${issuePairs.length})`);

    // 检查每个期号对
    for (const p of issuePairs) {
        const found = hwcDataList.find(d => d.base_issue === p.base_issue && d.target_issue === p.target_issue);
        console.log(`  ${p.base_issue}->${p.target_issue}: ${found ? '✅ 找到' : '❌ 未找到'}`);
    }

    // 3. 直接测试不同类型的查询
    console.log('\n=== 直接测试不同类型查询 ===');

    // 字符串查询
    const strResult = await HwcOptimized.findOne({
        base_issue: '25090',
        target_issue: '25091'
    }).lean();
    console.log(`字符串查询 '25090'->'25091': ${strResult ? '✅' : '❌'}`);

    // 数字查询
    const numResult = await HwcOptimized.findOne({
        base_issue: 25090,
        target_issue: 25091
    }).lean();
    console.log(`数字查询 25090->25091: ${numResult ? '✅' : '❌'}`);

    // 混合查询
    const mixResult = await HwcOptimized.findOne({
        base_issue: '25090',
        target_issue: 25091
    }).lean();
    console.log(`混合查询 '25090'->25091: ${mixResult ? '✅' : '❌'}`);

    // 4. 检查hit_dlts中Issue的类型
    console.log('\n=== 检查hit_dlts.Issue类型 ===');
    const dltSample = await hit_dlts.findOne({ Issue: 25090 }).lean();
    console.log(`使用数字查询 Issue=25090: ${dltSample ? '✅' : '❌'}`);
    if (dltSample) {
        console.log(`Issue值: ${dltSample.Issue} (${typeof dltSample.Issue})`);
    }

    const dltStrSample = await hit_dlts.findOne({ Issue: '25090' }).lean();
    console.log(`使用字符串查询 Issue='25090': ${dltStrSample ? '✅' : '❌'}`);

    await mongoose.disconnect();
}

testHwcQueryTypes().catch(e => { console.error(e); process.exit(1); });
