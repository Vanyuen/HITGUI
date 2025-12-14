const mongoose = require('mongoose');

async function simulatePreload() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    
    // 模拟任务的期号范围 (最近100期 + 推算期)
    // 假设用户选择了"最近100期"
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    
    // 1. 获取最新100期 + 推算期
    const latestRecords = await hit_dlts.find({})
        .sort({ Issue: -1 })
        .limit(100)
        .select('Issue ID')
        .lean();
    
    const issueNumbers = latestRecords.map(r => r.Issue).reverse();
    const maxIssue = Math.max(...issueNumbers);
    const predictedIssue = maxIssue + 1;
    
    // 添加推算期
    issueNumbers.push(predictedIssue);
    
    console.log('=== 模拟期号范围 ===');
    console.log('期号数量:', issueNumbers.length);
    console.log('最小期号:', issueNumbers[0]);
    console.log('最大期号:', issueNumbers[issueNumbers.length - 2]);
    console.log('推算期:', predictedIssue);
    
    // 2. 模拟 preloadData 的第一个分支逻辑
    // 检查第一个期号是否在数据库中
    const firstIssueRecord = await hit_dlts.findOne({ Issue: issueNumbers[0] }).lean();
    console.log('\n=== 模拟preloadData ===');
    console.log('第一个期号', issueNumbers[0], '在数据库中?', !!firstIssueRecord);
    
    if (!firstIssueRecord) {
        console.log('→ 走第一分支 (firstIssueNotInDb = true)');
    } else {
        console.log('→ 走第二分支 (firstIssueNotInDb = false)');
    }
    
    // 3. 模拟生成期号对
    console.log('\n=== 模拟生成期号对 ===');
    
    // 查询所有目标期号
    const allRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
        .select('Issue ID')
        .sort({ ID: 1 })
        .lean();
    
    console.log('数据库中找到的记录数:', allRecords.length);
    console.log('issueNumbers总数:', issueNumbers.length);
    
    // 构建ID→Record映射
    const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));
    
    // 过滤出在数据库中存在的期号
    const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
    console.log('issueRecords数量:', issueRecords.length);
    
    // 生成期号对
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
    
    console.log('\n生成的期号对数量:', issuePairs.length);
    console.log('最后5个期号对:');
    for (const p of issuePairs.slice(-5)) {
        console.log('  ', p.base_issue, '->', p.target_issue);
    }
    
    // 4. 检查推算期是否被处理
    console.log('\n=== 检查推算期处理 ===');
    const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
    const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));
    
    console.log('推算期列表:', predictedIssues);
    console.log('推算期是否在issuePairs中?');
    
    const has25142 = issuePairs.some(p => p.target_issue === '25142');
    console.log('  25142 作为 target_issue:', has25142);
    
    // 5. 模拟修复后的逻辑
    console.log('\n=== 修复后应该添加的期号对 ===');
    if (predictedIssues.length > 0) {
        const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
        console.log('最大已开奖期号:', maxExistingIssue);
        
        for (const pi of predictedIssues) {
            console.log('  应该添加:', maxExistingIssue, '->', pi);
        }
    }
    
    await mongoose.disconnect();
}

simulatePreload().catch(e => { console.error(e); process.exit(1); });
