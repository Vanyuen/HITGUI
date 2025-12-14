const mongoose = require('mongoose');

// 模拟predictNextIssue函数
async function predictNextIssue() {
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    const latestRecord = await hit_dlts.findOne().sort({ Issue: -1 }).select('Issue').lean();
    if (latestRecord) {
        return latestRecord.Issue + 1;
    }
    return null;
}

// 模拟getLatestIssue函数
async function getLatestIssue() {
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    const latestRecord = await hit_dlts.findOne().sort({ Issue: -1 }).select('Issue').lean();
    return latestRecord?.Issue || null;
}

// 模拟normalizeDLTIssueNumber函数
function normalizeDLTIssueNumber(issue) {
    return issue;
}

async function testResolveIssueRange() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }), 'hit_dlts');
    
    // 任务配置参数
    const startIssue = '25034';
    const endIssue = '25142';
    
    const normalizedStart = parseInt(normalizeDLTIssueNumber(startIssue));
    const normalizedEnd = parseInt(normalizeDLTIssueNumber(endIssue));
    
    console.log('=== 测试resolveIssueRangeInternal ===');
    console.log('startIssue:', normalizedStart);
    console.log('endIssue:', normalizedEnd);
    
    // 获取最新已开奖期号
    const latestIssue = await getLatestIssue();
    console.log('latestIssue (数据库最大):', latestIssue);
    
    // 计算实际结束期号
    const actualEndIssue = Math.min(normalizedEnd, latestIssue);
    console.log('actualEndIssue:', actualEndIssue);
    
    // 查询已开奖期号范围
    const customData = await hit_dlts.find({
        Issue: {
            $gte: normalizedStart,
            $lte: actualEndIssue
        }
    })
        .sort({ Issue: 1 })
        .select('Issue')
        .lean();
    
    const customIssues = customData.map(record => record.Issue.toString());
    console.log('已开奖期号数量:', customIssues.length);
    console.log('最后3期:', customIssues.slice(-3));
    
    // 检查是否需要追加推算期
    if (normalizedEnd > latestIssue) {
        console.log('\n结束期号超出已开奖范围，需要追加推算期');
        const nextIssue = await predictNextIssue();
        if (nextIssue) {
            customIssues.push(nextIssue.toString());
            console.log('追加推算期:', nextIssue);
        }
    } else {
        console.log('\n结束期号在已开奖范围内，不追加推算期');
    }
    
    console.log('\n=== 最终结果 ===');
    console.log('总期号数量:', customIssues.length);
    console.log('最后3期:', customIssues.slice(-3));
    console.log('是否包含25142?', customIssues.includes('25142'));
    
    await mongoose.disconnect();
}

testResolveIssueRange().catch(e => { console.error(e); process.exit(1); });
