/**
 * 诊断最后一期问题的完整模拟脚本
 * 模拟HwcPositivePredictor的完整执行流程
 */
const mongoose = require('mongoose');

async function diagnoseLastPeriod() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const dltSchema = new mongoose.Schema({}, { strict: false });
    const hit_dlts = mongoose.model('DLT_Diag2', dltSchema, 'hit_dlts');

    const hwcSchema = new mongoose.Schema({}, { strict: false });
    const HwcOptimized = mongoose.model('HWC_Diag2', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('=== 诊断最后一期问题 ===\n');

    // 任务期号：25085-25095
    const targetIssues = [];
    for (let i = 25085; i <= 25095; i++) {
        targetIssues.push(i.toString());
    }
    console.log('目标期号:', targetIssues.join(', '));

    // === 模拟 preloadData ===
    console.log('\n=== 模拟 preloadData ===');

    const issueNumbers = targetIssues.map(i => parseInt(i));
    const firstIssueNum = issueNumbers[0];

    // Step 1: 查询第一个期号
    const firstIssueRecord = await hit_dlts.findOne({ Issue: firstIssueNum })
        .select('Issue ID')
        .lean();
    console.log('第一个期号查询:', firstIssueRecord ? `Issue ${firstIssueRecord.Issue}, ID ${firstIssueRecord.ID}` : '不存在');

    // Step 2: 查询所有目标期号获取ID范围
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();
    console.log('目标期号记录数:', targetRecords.length);

    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('ID范围: minID=' + minID + ', maxID=' + maxID);

    // Step 3: 用ID范围查询所有记录
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();
    console.log('ID范围查询结果:', allRecords.length, '条');

    // Step 4: 构建映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueToIdMap = new Map();
    for (const record of allRecords) {
        issueToIdMap.set(record.Issue.toString(), record.ID);
    }
    console.log('idToRecordMap大小:', idToRecordMap.size);
    console.log('issueToIdMap大小:', issueToIdMap.size);

    // 验证最后一期是否在映射中
    const lastIssue = targetIssues[targetIssues.length - 1]; // "25095"
    const lastID = issueToIdMap.get(lastIssue);
    console.log('\n最后一期', lastIssue, '的ID:', lastID);
    console.log('issueToIdMap包含最后一期:', issueToIdMap.has(lastIssue));

    // Step 5: 构建期号对
    const issuePairs = [];
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('\n目标期号在allRecords中:', issueRecords.length, '条');

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
            console.log('警告: 期号', targetIssue, '(ID=' + targetID + ')的ID-1记录不存在');
        }
    }
    console.log('生成期号对:', issuePairs.length, '个');

    // 检查25095的期号对
    const pair25095 = issuePairs.find(p => p.target_issue === '25095');
    console.log('25095的期号对:', pair25095 ? pair25095.base_issue + '->' + pair25095.target_issue : '不存在!');

    // === 模拟 preloadHwcOptimizedData ===
    console.log('\n=== 模拟 preloadHwcOptimizedData ===');

    const hwcDataList = await HwcOptimized.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();
    console.log('HWC数据查询结果:', hwcDataList.length, '条');

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
    console.log('hwcOptimizedCache大小:', hwcOptimizedCache.size);

    // 检查25095的HWC缓存
    const key25095 = pair25095 ? `${pair25095.base_issue}-${pair25095.target_issue}` : null;
    console.log('25095的hwcKey:', key25095);
    if (key25095) {
        const hwcMap = hwcOptimizedCache.get(key25095);
        console.log('25095的hwcMap存在:', !!hwcMap);
        if (hwcMap) {
            const ratio311 = hwcMap.get('3:1:1');
            console.log('25095的3:1:1比例组合数:', ratio311 ? ratio311.length : 0);
        }
    }

    // === 模拟 processBatch ===
    console.log('\n=== 模拟 processBatch ===');

    // 模拟issuesBatch（就是targetIssues）
    const issuesBatch = targetIssues;

    // 模拟issueToIDArray的构建
    const issueToIDArray = issuesBatch.map((issue, index) => {
        const issueStr = issue.toString();
        const id = issueToIdMap.get(issueStr);
        if (!id) {
            console.log('警告: Issue', issueStr, '没有对应的ID');
        }
        return { issue: issueStr, id: id || null, index };
    });

    console.log('issueToIDArray构建结果:');
    for (const item of issueToIDArray) {
        console.log('  index=' + item.index + ', issue=' + item.issue + ', id=' + (item.id || 'null'));
    }

    // 模拟处理最后一期
    console.log('\n=== 处理最后一期 (index=' + (issueToIDArray.length - 1) + ') ===');
    const lastItem = issueToIDArray[issueToIDArray.length - 1];
    const targetIssue = lastItem.issue;
    const targetID = lastItem.id;

    console.log('targetIssue:', targetIssue);
    console.log('targetID:', targetID);

    let baseIssue;
    if (targetID !== null) {
        const baseRecord = idToRecordMap.get(targetID - 1);
        console.log('查找ID-1(' + (targetID - 1) + ')的记录:', baseRecord ? `Issue ${baseRecord.Issue}` : '不存在!');

        if (baseRecord) {
            baseIssue = baseRecord.Issue.toString();
            console.log('baseIssue:', baseIssue);
        } else {
            console.log('ERROR: baseRecord不存在!');
        }
    } else {
        console.log('ERROR: targetID为null!');
    }

    // 模拟applyPositiveSelection的hwcKey查找
    if (baseIssue) {
        const hwcKey = `${baseIssue}-${targetIssue}`;
        const hwcMap = hwcOptimizedCache.get(hwcKey);
        console.log('\nhwcKey:', hwcKey);
        console.log('hwcMap存在:', !!hwcMap);

        if (hwcMap) {
            const selectedRatios = ['3:1:1']; // 模拟选择的热温冷比
            let candidateCount = 0;
            for (const ratio of selectedRatios) {
                const ids = hwcMap.get(ratio) || [];
                candidateCount += ids.length;
            }
            console.log('候选组合数 (3:1:1):', candidateCount);
        } else {
            // 检查缓存中实际有哪些key
            console.log('\n缓存中的所有key:');
            for (const k of hwcOptimizedCache.keys()) {
                console.log('  ', k);
            }
        }
    }

    await mongoose.disconnect();
}

diagnoseLastPeriod().catch(e => { console.error(e); process.exit(1); });
