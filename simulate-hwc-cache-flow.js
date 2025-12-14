/**
 * 模拟HWC缓存加载和查询过程，追踪批次边界失败原因
 */
const mongoose = require('mongoose');

async function simulateHwcCacheFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_Sim', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    const dltSchema = new mongoose.Schema({}, { strict: false });
    const hit_dlts = mongoose.model('DLT_Sim', dltSchema, 'hit_dlts');

    console.log('=== 模拟HWC缓存流程 ===\n');

    // 模拟任务期号范围: 25042-25142 (101期)
    const taskPeriods = [];
    for (let i = 25042; i <= 25142; i++) {
        taskPeriods.push(i);
    }
    console.log(`任务期号范围: ${taskPeriods[0]}-${taskPeriods[taskPeriods.length-1]} (${taskPeriods.length}期)\n`);

    // === 步骤1: 模拟preloadData中的期号对构建 ===
    console.log('=== 步骤1: 构建期号对 (模拟preloadData) ===');

    const issueNumbers = taskPeriods.map(p => parseInt(p));
    const firstIssueNum = issueNumbers[0];

    const firstIssueRecord = await hit_dlts.findOne({ Issue: firstIssueNum })
        .select('Issue ID')
        .lean();

    console.log(`首个期号查询: Issue=${firstIssueNum}, 结果=${firstIssueRecord ? 'ID=' + firstIssueRecord.ID : '不存在'}`);

    // 获取所有目标期号的记录
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`目标期号查询: ${targetRecords.length}条记录`);

    // 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log(`ID范围: ${minID} - ${maxID}`);

    // 使用ID范围查询所有需要的记录
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();

    console.log(`ID范围查询: ${allRecords.length}条记录 (ID ${minID-1} ~ ${maxID})`);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    // 构建期号对
    const issuePairs = [];
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

    console.log(`构建期号对: ${issuePairs.length}个 (含${predictedIssues.length}个推算期)`);

    // 检查批次边界期号对是否在列表中
    console.log('\n=== 检查批次边界期号对 ===');
    const boundaryTargets = ['25091', '25141', '25142'];
    for (const target of boundaryTargets) {
        const pair = issuePairs.find(p => p.target_issue === target);
        console.log(`目标期号${target}: ${pair ? pair.base_issue + '->' + pair.target_issue : '❌ 不在期号对列表中!'}`);
    }

    // === 步骤2: 模拟preloadHwcOptimizedData ===
    console.log('\n=== 步骤2: 模拟preloadHwcOptimizedData ===');

    const hwcDataList = await HwcOptimized.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();

    console.log(`HWC数据查询: ${hwcDataList.length}条 (期望: ${issuePairs.length})`);

    // 构建缓存
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

    console.log(`HWC缓存构建: ${hwcOptimizedCache.size}个期号对`);

    // 检查批次边界期号的缓存
    console.log('\n=== 检查批次边界期号的缓存状态 ===');
    const boundaryPairs = [
        { base: '25090', target: '25091' },
        { base: '25140', target: '25141' },
        { base: '25141', target: '25142' },
    ];

    for (const pair of boundaryPairs) {
        const key = `${pair.base}-${pair.target}`;
        const hwcMap = hwcOptimizedCache.get(key);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1');
            console.log(`${key}: ✅ 缓存命中 (3:1:1比例: ${ratio311 ? ratio311.length : 0}个组合)`);
        } else {
            console.log(`${key}: ❌ 缓存未命中!`);

            // 检查这个key是否在期号对列表中
            const inList = issuePairs.some(p => p.base_issue === pair.base && p.target_issue === pair.target);
            console.log(`    -> 在期号对列表中: ${inList ? '是' : '否'}`);

            // 直接查询数据库看数据是否存在
            const dbData = await HwcOptimized.findOne({
                base_issue: pair.base,
                target_issue: pair.target
            }).lean();
            console.log(`    -> 数据库中存在: ${dbData ? '是' : '否'}`);
        }
    }

    // === 步骤3: 对比正常期号 ===
    console.log('\n=== 对比正常期号的缓存状态 ===');
    const normalPairs = [
        { base: '25088', target: '25089' },
        { base: '25089', target: '25090' },
        { base: '25091', target: '25092' },
        { base: '25092', target: '25093' },
    ];

    for (const pair of normalPairs) {
        const key = `${pair.base}-${pair.target}`;
        const hwcMap = hwcOptimizedCache.get(key);
        console.log(`${key}: ${hwcMap ? '✅ 缓存命中' : '❌ 缓存未命中'}`);
    }

    // === 步骤4: 分析缓存未命中的原因 ===
    console.log('\n=== 分析缓存问题 ===');
    const cacheKeys = Array.from(hwcOptimizedCache.keys());
    console.log(`缓存中的前10个key: ${cacheKeys.slice(0, 10).join(', ')}`);
    console.log(`缓存中的后10个key: ${cacheKeys.slice(-10).join(', ')}`);

    // 检查是否有25090-25091这个key
    const has25090to25091 = cacheKeys.includes('25090-25091');
    console.log(`\n缓存中包含 '25090-25091': ${has25090to25091}`);

    // 检查查询结果中是否有这个期号对
    const inQueryResult = hwcDataList.some(d => d.base_issue === '25090' && d.target_issue === '25091');
    console.log(`查询结果中包含 25090->25091: ${inQueryResult}`);

    // 检查$or查询是否包含这个期号对
    const inOrQuery = issuePairs.some(p => p.base_issue === '25090' && p.target_issue === '25091');
    console.log(`$or查询条件中包含 25090->25091: ${inOrQuery}`);

    await mongoose.disconnect();
}

simulateHwcCacheFlow().catch(e => { console.error(e); process.exit(1); });
