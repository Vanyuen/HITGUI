/**
 * 检查数据库中最新期号
 */
const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const dltCollection = mongoose.connection.collection('hit_dlts');

        // 查询最新10期
        const latestRecords = await dltCollection.find({})
            .sort({ Issue: -1 })
            .limit(10)
            .toArray();

        console.log('📋 数据库中最新10期大乐透数据:');
        for (const r of latestRecords) {
            console.log(`  期号 ${r.Issue} (ID: ${r.ID}): 红球 ${r.Red1} ${r.Red2} ${r.Red3} ${r.Red4} ${r.Red5}, 蓝球 ${r.Blue1} ${r.Blue2}`);
        }

        // 检查25141和25142
        const issue25141 = await dltCollection.findOne({ Issue: 25141 });
        const issue25142 = await dltCollection.findOne({ Issue: 25142 });

        console.log('\n🔍 检查特定期号:');
        console.log('  25141:', issue25141 ? `存在 (ID: ${issue25141.ID})` : '不存在');
        console.log('  25142:', issue25142 ? `存在 (ID: ${issue25142.ID})` : '不存在');

        // 获取最大期号
        const maxIssue = await dltCollection.findOne({}, { sort: { Issue: -1 } });
        console.log('\n📊 最大期号:', maxIssue?.Issue);

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ 错误:', err.message);
        process.exit(1);
    }
}

check();
