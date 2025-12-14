// 诊断：完整模拟preloadData流程（101期）
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    await mongoose.connect(MONGODB_URI);
    console.log('=== 诊断：完整模拟preloadData流程（101期） ===\n');

    const db = mongoose.connection.db;

    // 模拟任务参数：最近100期 + 1期推算 = 101期
    const targetIssues = [];
    for (let i = 25042; i <= 25142; i++) {
        targetIssues.push(i);
    }
    console.log(`[参数] 目标期号: ${targetIssues[0]}-${targetIssues[targetIssues.length - 1]} (共${targetIssues.length}期)`);

    // ============ 模拟preloadData ============
    const issueNumbers = targetIssues.map(i => parseInt(String(i)));
    const firstIssueNum = issueNumbers[0];

    console.log(`\n[Step 1] 查询第一个期号 ${firstIssueNum}...`);
    const firstIssueRecord = await db.collection('hit_dlts').findOne({ Issue: firstIssueNum });
    console.log(`  结果: ${firstIssueRecord ? `存在 (ID=${firstIssueRecord.ID})` : '不存在'}`);

    // 查询所有目标期号
    console.log('\n[Step 2] 查询所有目标期号...');
    const targetRecords = await db.collection('hit_dlts')
        .find({ Issue: { $in: issueNumbers } })
        .sort({ ID: 1 })
        .toArray();
    console.log(`  找到${targetRecords.length}条记录`);
    console.log(`  最后3条: ${targetRecords.slice(-3).map(r => `${r.Issue}(ID=${r.ID})`).join(', ')}`);

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log(`  ID范围: ${minID} - ${maxID}`);

    // 查询完整ID范围
    console.log('\n[Step 3] 查询完整ID范围...');
    const allRecords = await db.collection('hit_dlts')
        .find({ ID: { $gte: minID - 1, $lte: maxID } })
        .sort({ ID: 1 })
        .toArray();
    console.log(`  找到${allRecords.length}条记录 (ID ${minID - 1} ~ ${maxID})`);

    // 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

    // 生成期号对
    console.log('\n[Step 4] 生成期号对...');
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log(`  issueRecords: ${issueRecords.length}条`);

    const issuePairs = [];
    for (const record of issueRecords) {
        const targetID = record.ID;
        const targetIssue = record.Issue.toString();
        const baseRecord = idToRecordMap.get(targetID - 1);

        if (baseRecord) {
            issuePairs.push({
                base_issue: baseRecord.Issue.toString(),
                target_issue: targetIssue
            });
        } else {
            console.log(`  ⚠️ 期号${targetIssue}(ID=${targetID})缺少上一期(ID=${targetID - 1})`);
        }
    }

    // 处理推算期
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
    console.log(`  推算期: ${predictedIssues.join(', ') || '无'}`);

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
            console.log(`  添加推算期期号对: ${maxRecord.Issue}->${predictedIssues.join(', ')}`);
        }
    }

    console.log(`  总计生成${issuePairs.length}个期号对`);

    // 检查关键期号对是否在列表中
    console.log('\n[Step 5] 检查关键期号对是否在issuePairs中:');
    const keyPairs = [
        { base: '25139', target: '25140' },
        { base: '25140', target: '25141' },
        { base: '25141', target: '25142' }
    ];
    for (const pair of keyPairs) {
        const found = issuePairs.find(p => p.base_issue === pair.base && p.target_issue === pair.target);
        console.log(`  ${pair.base}->${pair.target}: ${found ? '✅ 在列表中' : '❌ 不在列表中'}`);
    }

    // ============ 模拟preloadHwcOptimizedData ============
    console.log('\n[Step 6] 模拟preloadHwcOptimizedData查询...');
    console.log(`  构建$or查询: ${issuePairs.length}个条件`);

    // 定义使用正确collection的Model
    const hwcSchema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed
    });
    let HwcModel;
    try {
        HwcModel = mongoose.model('TestHwcModel', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');
    } catch (e) {
        HwcModel = mongoose.model('TestHwcModel');
    }

    const startTime = Date.now();
    const hwcDataList = await HwcModel.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();
    const queryTime = Date.now() - startTime;

    console.log(`  查询结果: ${hwcDataList.length}条 (耗时${queryTime}ms)`);

    if (hwcDataList.length < issuePairs.length) {
        console.log(`  ⚠️ 缺少${issuePairs.length - hwcDataList.length}个期号对的数据`);
    }

    // 构建缓存
    console.log('\n[Step 7] 构建hwcOptimizedCache...');
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
    console.log(`  缓存大小: ${hwcOptimizedCache.size}个期号对`);

    // 验证关键期号对
    console.log('\n[Step 8] 验证关键期号对在缓存中:');
    const testKeys = ['25139-25140', '25140-25141', '25141-25142'];
    for (const key of testKeys) {
        const hwcMap = hwcOptimizedCache.get(key);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1') || [];
            console.log(`  ${key}: ✅ 找到 (3:1:1有${ratio311.length}个组合)`);
        } else {
            console.log(`  ${key}: ❌ 未找到`);
        }
    }

    // ============ 模拟processBatch中的HWC查找 ============
    console.log('\n[Step 9] 模拟processBatch中的HWC查找:');

    // 构建issueToIdMap
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }

    // 模拟批次2的处理 (25092-25141)
    const batch2Issues = issueNumbers.slice(50, 100); // indices 50-99
    console.log(`  批次2: ${batch2Issues[0]}-${batch2Issues[batch2Issues.length - 1]} (${batch2Issues.length}期)`);

    // 对关键期号进行查找测试（包含推算期）
    for (const targetIssueNum of [25140, 25141, 25142]) {
        const targetIssue = targetIssueNum.toString();
        const targetID = issueToIdMap.get(targetIssue);

        console.log(`\n  ---- 处理期号 ${targetIssue} ----`);
        console.log(`    targetID: ${targetID || '(推算期，无ID)'}`);

        let baseIssue, hwcKey;

        if (targetID !== null && targetID !== undefined) {
            // 已开奖期号：使用ID-1规则
            const baseRecord = idToRecordMap.get(targetID - 1);
            if (baseRecord) {
                baseIssue = baseRecord.Issue.toString();
                console.log(`    方式: ID-1规则, baseIssue=${baseIssue}`);
            } else {
                console.log(`    baseRecord: ❌ 不存在 (ID=${targetID - 1})`);
                continue;
            }
        } else {
            // 推算期：使用最大已开奖期号
            const maxExistingIssue = Math.max(...Array.from(issueToIdMap.keys()).map(k => parseInt(k)));
            baseIssue = maxExistingIssue.toString();
            console.log(`    方式: 推算期，使用最大已开奖期号 baseIssue=${baseIssue}`);
        }

        hwcKey = `${baseIssue}-${targetIssue}`;
        console.log(`    hwcKey: ${hwcKey}`);

        const hwcMap = hwcOptimizedCache.get(hwcKey);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1') || [];
            console.log(`    hwcMap: ✅ 找到 (3:1:1有${ratio311.length}个组合)`);
        } else {
            console.log(`    hwcMap: ❌ 未找到！这是问题根源`);
        }
    }

    await mongoose.disconnect();
    console.log('\n=== 诊断完成 ===');
}

diagnose().catch(err => {
    console.error('诊断失败:', err);
    process.exit(1);
});
