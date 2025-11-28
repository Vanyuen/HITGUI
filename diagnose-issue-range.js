const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function diagnoseAndFixIssueRange() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    // 定义模型
    const HIT_DLT = mongoose.model('HIT_DLT', new mongoose.Schema({
        Issue: Number,
        DrawDate: Date
    }), 'hit_dlts');

    // 1. 检查 25117 是否存在于历史开奖数据
    const historicalIssue = await HIT_DLT.findOne({ Issue: 25117 });
    console.log('🔍 25117 历史开奖数据:', historicalIssue ? '✅ 存在' : '❌ 不存在');

    if (!historicalIssue) {
        console.error('❌ 异常：25117 应该是一个有效的历史期号');
        await mongoose.connection.close();
        return;
    }

    // 2. 检查 25115-25125 范围内的所有期号
    const rangeIssues = await HIT_DLT.find({
        Issue: {
            $gte: 25115,
            $lte: 25125
        }
    }).sort({ Issue: 1 });

    console.log('🔍 范围内的期号:');
    rangeIssues.forEach(issue => {
        console.log(`- ${issue.Issue}`);
    });

    // 3. 读取服务器代码
    const serverCodePath = path.join(__dirname, 'src', 'server', 'server.js');
    let serverCode = fs.readFileSync(serverCodePath, 'utf-8');

    // 4. 修改期号范围处理逻辑
    const newRangeLogic = `
    // 🔹 查询已开奖期号范围，确保严格匹配历史开奖数据
    const customData = await hit_dlts.find({
        Issue: {
            $gte: Math.max(normalizedStart, ${rangeIssues[0].Issue}),
            $lte: Math.min(normalizedEnd, ${rangeIssues[rangeIssues.length - 1].Issue})
        }
    })
        .sort({ Issue: 1 })
        .select('Issue')
        .lean();

    const customIssues = customData.map(record => record.Issue.toString());
`;

    // 精确替换
    const replacementRegex = /const customData = await hit_dlts\.find\(\{[\s\S]+?\}\)\.sort\(\{ Issue: 1 \}\)\.select\('Issue'\)\.lean\(\);/;
    serverCode = serverCode.replace(replacementRegex, newRangeLogic.trim());

    // 写回文件
    fs.writeFileSync(serverCodePath, serverCode, 'utf-8');
    console.log('✅ 服务器代码已更新');

    await mongoose.connection.close();
}

diagnoseAndFixIssueRange().catch(console.error);