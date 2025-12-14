/**
 * 模拟HwcPositivePredictor的实际执行
 * 测试preloadData和processBatch的完整流程
 */
const mongoose = require('mongoose');

// 简化版的模拟测试
async function testPredictorFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 定义需要的模型
    const dltSchema = new mongoose.Schema({}, { strict: false });
    const hit_dlts = mongoose.model('DLT_Flow', dltSchema, 'hit_dlts');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HWC_Flow', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== 测试HwcPositivePredictor流程 ===\n');

    // 模拟任务期号: 25042-25142
    const taskPeriods = [];
    for (let i = 25042; i <= 25142; i++) {
        taskPeriods.push(i);
    }

    // 模拟HwcPositivePredictor的preloadData方法
    console.log('=== 模拟preloadData ===');

    const issueNumbers = taskPeriods.map(i => parseInt(i.toString ? i.toString() : String(i)));
    const firstIssueNum = issueNumbers[0];

    const firstIssueRecord = await hit_dlts.findOne({ Issue: firstIssueNum })
        .select('Issue ID')
        .lean();

    console.log(`firstIssueRecord: ${firstIssueRecord ? 'Issue=' + firstIssueRecord.Issue + ', ID=' + firstIssueRecord.ID : '不存在'}`);

    // 由于firstIssueRecord存在，走正常路径
    const issuePairs = [];

    // 查询所有目标期号
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`targetRecords: ${targetRecords.length}条`);

    // 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;

    // 查询所有需要的记录
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`allRecords: ${allRecords.length}条 (ID ${minID-1} ~ ${maxID})`);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    // 构建期号对
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    for (const record of issueRecords) {
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

    // 添加推算期
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
    if (predictedIssues.length > 0) {
        const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
        const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);
        if (maxRecord) {
            for (const predictedIssue of predictedIssues) {
                issuePairs.push({
                    base_issue: maxRecord.Issue.toString(),
                    target_issue: predictedIssue.toString()
                });
            }
        }
    }

    console.log(`issuePairs: ${issuePairs.length}个`);

    // 检查批次边界期号对
    console.log('\n批次边界期号对检查:');
    for (const target of ['25091', '25141', '25142']) {
        const pair = issuePairs.find(p => p.target_issue === target);
        console.log(`  ${target}: ${pair ? pair.base_issue + '->' + pair.target_issue : '不存在!'}`);
    }

    // 模拟preloadHwcOptimizedData
    console.log('\n=== 模拟preloadHwcOptimizedData ===');

    const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();

    console.log(`hwcDataList: ${hwcDataList.length}条`);

    const hwcOptimizedCache = new Map();
    for (const data of hwcDataList) {
        const key = `${data.base_issue}-${data.target_issue}`;
        if (data.hot_warm_cold_data) {
            const hwcMap = new Map();
            for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
                hwcMap.set(ratio, ids);
            }
            hwcOptimizedCache.set(key, hwcMap);
        }
    }

    console.log(`hwcOptimizedCache: ${hwcOptimizedCache.size}个期号对`);

    // 模拟批次分割
    console.log('\n=== 模拟批次分割 ===');
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < taskPeriods.length; i += batchSize) {
        batches.push(taskPeriods.slice(i, i + batchSize));
    }
    console.log(`共${batches.length}个批次:`);
    for (let b = 0; b < batches.length; b++) {
        console.log(`  批次${b+1}: ${batches[b][0]}-${batches[b][batches[b].length-1]} (${batches[b].length}期)`);
    }

    // 模拟processBatch处理批次边界期号
    console.log('\n=== 模拟processBatch处理批次边界 ===');

    for (const period of [25091, 25141, 25142]) {
        const targetIssue = period.toString();
        const targetID = issueToIdMap.get(targetIssue);

        console.log(`\n期号${period}:`);
        console.log(`  targetID: ${targetID || 'null'}`);

        let baseIssue;
        if (targetID) {
            const baseRecord = idToRecordMap.get(targetID - 1);
            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                console.log(`  baseRecord: Issue=${baseRecord.Issue} (ID=${baseRecord.ID})`);
            } else {
                console.log(`  baseRecord: 不存在! (ID ${targetID - 1})`);
            }
        } else {
            // 推算期
            console.log(`  推算期，使用最新期号作为基准`);
            const latestRecord = allRecords[allRecords.length - 1];
            baseIssue = latestRecord.Issue.toString();
            console.log(`  baseRecord: Issue=${latestRecord.Issue} (最新)`);
        }

        if (baseIssue) {
            const hwcKey = `${baseIssue}-${targetIssue}`;
            const hwcMap = hwcOptimizedCache.get(hwcKey);
            console.log(`  hwcKey: ${hwcKey}`);
            console.log(`  hwcMap存在: ${!!hwcMap}`);

            if (hwcMap) {
                const ratio311 = hwcMap.get('3:1:1');
                console.log(`  3:1:1比例组合数: ${ratio311 ? ratio311.length : 0}`);
            }
        }
    }

    await mongoose.disconnect();
}

testPredictorFlow().catch(e => { console.error(e); process.exit(1); });
