const mongoose = require('mongoose');

async function testIssueRangeResolution() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        const HIT_DLT = mongoose.model('HIT_DLT', {
            Issue: Number,
            DrawDate: Date
        }, 'hit_dlts');

        // 检查范围内的历史期号
        const historicalIssues = await HIT_DLT.find({
            Issue: {
                $gte: 25115,
                $lte: 25125
            }
        }).sort({ Issue: 1 });

        console.log('🔍 25115-25125 范围内的历史期号:');
        historicalIssues.forEach(issue => {
            console.log(`- 期号: ${issue.Issue}`);
        });

        // 验证最后一个期号
        const latestIssue = await HIT_DLT.findOne().sort({ Issue: -1 });
        console.log(`\n🔍 最新已开奖期号: ${latestIssue.Issue}`);

        // 推算下一期期号
        const predictedNextIssue = latestIssue.Issue + 1;
        console.log(`🔍 预测下一期期号: ${predictedNextIssue}`);

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testIssueRangeResolution().catch(console.error);