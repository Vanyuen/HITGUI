const mongoose = require('mongoose');

async function testIssueRangeResolution() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        // 引入服务器代码中的函数
        const { resolveIssueRangeInternal } = require('./src/server/server.js');

        console.log('🔍 测试自定义期号范围解析');

        // 测试案例1：完全在已开奖范围内
        const result1 = await resolveIssueRangeInternal({
            rangeType: 'custom',
            startIssue: '25115',
            endIssue: '25124'
        });

        console.log('测试案例1 (25115-25124):', result1);
        console.log('✅ 期号数量:', result1.length);
        console.log('✅ 第一个期号:', result1[0]);
        console.log('✅ 最后一个期号:', result1[result1.length - 1]);

        // 测试案例2：包含推算期
        const result2 = await resolveIssueRangeInternal({
            rangeType: 'custom',
            startIssue: '25115',
            endIssue: '25125'
        });

        console.log('\n测试案例2 (25115-25125):', result2);
        console.log('✅ 期号数量:', result2.length);
        console.log('✅ 第一个期号:', result2[0]);
        console.log('✅ 最后一个期号:', result2[result2.length - 1]);

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testIssueRangeResolution().catch(console.error);