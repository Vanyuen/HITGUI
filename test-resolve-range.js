const mongoose = require('mongoose');

async function testResolveRange() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    
    const db = mongoose.connection.db;
    const collection = db.collection('hit_dlts');
    
    const startIssue = '25034';
    const endIssue = '25142';
    
    const normalizedStart = parseInt(startIssue);
    const normalizedEnd = parseInt(endIssue);
    
    console.log('=== 测试resolveIssueRangeInternal ===');
    console.log('startIssue:', normalizedStart);
    console.log('endIssue:', normalizedEnd);
    
    // 获取最新已开奖期号
    const latestRecord = await collection.findOne({}, { sort: { Issue: -1 }, projection: { Issue: 1 }});
    const latestIssue = latestRecord?.Issue;
    console.log('latestIssue:', latestIssue);
    
    // 计算实际结束期号
    const actualEndIssue = Math.min(normalizedEnd, latestIssue);
    console.log('actualEndIssue:', actualEndIssue);
    
    // 查询已开奖期号范围
    const customData = await collection.find({
        Issue: { $gte: normalizedStart, $lte: actualEndIssue }
    })
        .sort({ Issue: 1 })
        .project({ Issue: 1 })
        .toArray();
    
    const customIssues = customData.map(record => record.Issue.toString());
    console.log('已开奖期号数量:', customIssues.length);
    console.log('最后3期:', customIssues.slice(-3));
    
    // 检查是否需要追加推算期
    if (normalizedEnd > latestIssue) {
        console.log('\n结束期号超出已开奖范围，需要追加推算期');
        const nextIssue = latestIssue + 1;
        customIssues.push(nextIssue.toString());
        console.log('追加推算期:', nextIssue);
    } else {
        console.log('\n结束期号在已开奖范围内，不追加推算期');
    }
    
    console.log('\n=== 最终结果 ===');
    console.log('总期号数量:', customIssues.length);
    console.log('最后3期:', customIssues.slice(-3));
    console.log('是否包含25142?', customIssues.includes('25142'));
    
    await mongoose.disconnect();
}

testResolveRange().catch(e => { console.error(e); process.exit(1); });
