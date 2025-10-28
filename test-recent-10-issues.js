/**
 * 测试"最近10期"功能的实际行为
 * 目的: 确认当前返回的是10期还是11期(10+1)
 */

const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const dltSchema = new mongoose.Schema({
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number,
    Date: String
}, { collection: 'hit_dlts' });

const DLT = mongoose.model('DLT', dltSchema);

/**
 * 推算下一期期号
 */
async function predictNextIssue() {
    const latestRecord = await DLT.findOne({}).sort({ Issue: -1 }).select('Issue').lean();
    if (!latestRecord) return null;
    return latestRecord.Issue + 1;
}

/**
 * 模拟后端 resolveIssueRangeInternal 的 'recent' 分支逻辑
 */
async function testRecentLogic(recentCount) {
    console.log(`\n🧪 测试: 最近${recentCount}期`);
    console.log('='.repeat(60));

    // 按ID顺序(Issue降序)取最近N条记录
    const recentData = await DLT.find({})
        .sort({ Issue: -1 })
        .limit(recentCount)
        .select('Issue')
        .lean();

    const issues = recentData.map(record => record.Issue.toString()).reverse(); // 转升序

    console.log(`\n📊 取出的已开奖记录数: ${issues.length}`);
    console.log(`📋 期号范围: ${issues[0]} ~ ${issues[issues.length - 1]}`);

    // 推算下一期期号并追加
    const nextIssue = await predictNextIssue();
    if (nextIssue) {
        issues.push(nextIssue.toString());
        console.log(`\n🔮 推算的下一期: ${nextIssue}`);
        console.log(`✅ 最终返回期数: ${issues.length}期 (${recentCount}期已开奖 + 1期推算)`);
    } else {
        console.log(`\n⚠️ 无法推算下一期，仅返回${issues.length}期已开奖`);
    }

    console.log(`\n📝 最终期号列表:`);
    issues.forEach((issue, idx) => {
        const label = idx === issues.length - 1 ? '(推算下一期)' : '';
        console.log(`  [${idx + 1}] ${issue} ${label}`);
    });

    return issues;
}

async function main() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ 已连接到数据库');

        // 获取总记录数
        const totalCount = await DLT.countDocuments();
        console.log(`📚 数据库总记录数: ${totalCount}`);

        // 获取最新期号
        const latestRecord = await DLT.findOne({}).sort({ Issue: -1 }).select('Issue').lean();
        console.log(`📅 最新已开奖期号: ${latestRecord.Issue}`);

        // 测试最近10期
        await testRecentLogic(10);

        // 测试最近100期
        await testRecentLogic(100);

        mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

main();
