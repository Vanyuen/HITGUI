const mongoose = require('mongoose');

async function fullSimulation() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    const HwcOpt = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized',
        new mongoose.Schema({}, { strict: false }),
        'hit_dlt_redcombinationshotwarmcoldoptimizeds');
    
    // 1. 模拟最近100期 + 推算期
    console.log('=== Step 1: 模拟期号范围 ===');
    const latestRecords = await hit_dlts.find({})
        .sort({ Issue: -1 })
        .limit(100)
        .select('Issue ID')
        .lean();
    
    const targetIssues = latestRecords.map(r => r.Issue).reverse();
    const maxIssue = Math.max(...targetIssues);
    targetIssues.push(maxIssue + 1);  // 添加推算期
    
    console.log('期号数量:', targetIssues.length);
    console.log('最后3期:', targetIssues.slice(-3));
    
    // 2. 模拟 preloadData 的第二分支
    console.log('\n=== Step 2: 模拟preloadData (Branch 2) ===');
    const issueNumbers = targetIssues.map(i => parseInt(i.toString()));
    console.log('issueNumbers类型:', typeof issueNumbers[0]);
    console.log('最后3个issueNumbers:', issueNumbers.slice(-3));
    
    // 2.1 查询第一个期号
    const firstIssueNum = issueNumbers[0];
    const firstIssueRecord = await hit_dlts.findOne({ Issue: firstIssueNum }).lean();
    console.log('第一个期号', firstIssueNum, '存在?', !!firstIssueRecord);
    
    // 2.2 查询所有目标期号获取ID
    const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();
    console.log('targetRecords数量:', targetRecords.length, '(期望:', issueNumbers.length - 1, ')');
    
    // 2.3 计算ID范围
    const minID = targetRecords[0].ID;
    const maxID = targetRecords[targetRecords.length - 1].ID;
    console.log('ID范围:', minID, '-', maxID);
    
    // 2.4 查询完整ID范围
    const allRecords = await hit_dlts.find({
        ID: { $gte: minID - 1, $lte: maxID }
    })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();
    console.log('allRecords数量:', allRecords.length);
    
    // 2.5 生成期号对
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('issueRecords数量:', issueRecords.length);
    
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
        }
    }
    console.log('初始期号对数量:', issuePairs.length);
    console.log('最后3个期号对:', issuePairs.slice(-3).map(p => p.base_issue + '->' + p.target_issue));
    
    // 2.6 修复代码：添加推算期期号对
    console.log('\n=== Step 3: 添加推算期期号对 ===');
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    console.log('existingIssueNums中的值类型:', typeof Array.from(existingIssueNums)[0]);
    
    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
    console.log('predictedIssues:', predictedIssues);
    
    if (predictedIssues.length > 0) {
        const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
        const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);
        console.log('maxExistingIssue:', maxExistingIssue);
        console.log('maxRecord:', maxRecord);
        
        if (maxRecord) {
            for (const predictedIssue of predictedIssues) {
                issuePairs.push({
                    base_issue: maxRecord.Issue.toString(),
                    target_issue: predictedIssue.toString()
                });
                console.log('添加推算期期号对:', maxRecord.Issue, '->', predictedIssue);
            }
        }
    }
    
    console.log('\n最终期号对数量:', issuePairs.length);
    console.log('最后3个期号对:', issuePairs.slice(-3).map(p => p.base_issue + '->' + p.target_issue));
    
    // 3. 模拟 preloadHwcOptimizedData
    console.log('\n=== Step 4: 模拟preloadHwcOptimizedData ===');
    
    // 只查询最后3个期号对
    const lastPairs = issuePairs.slice(-3);
    console.log('查询的期号对:', lastPairs);
    
    const hwcDataList = await HwcOpt.find({
        $or: lastPairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();
    
    console.log('查询到的HWC数据数量:', hwcDataList.length);
    
    for (const data of hwcDataList) {
        console.log('  找到:', data.base_issue, '->', data.target_issue);
        if (data.hot_warm_cold_data) {
            const ratios = Object.keys(data.hot_warm_cold_data);
            console.log('    ratio数量:', ratios.length);
            if (data.hot_warm_cold_data['3:1:1']) {
                console.log('    3:1:1组合数:', data.hot_warm_cold_data['3:1:1'].length);
            }
        }
    }
    
    // 检查25141-25142是否被查询到
    const has25141_25142 = hwcDataList.some(d => 
        d.base_issue === '25141' && d.target_issue === '25142'
    );
    console.log('\n25141-25142是否被查询到?', has25141_25142);
    
    await mongoose.disconnect();
}

fullSimulation().catch(e => { console.error(e); process.exit(1); });
