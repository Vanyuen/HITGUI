const mongoose = require('mongoose');

async function diagnoseIssueType() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const hit_dlts = mongoose.connection.collection('hit_dlts');

        console.log('📊 检查Issue字段类型和数据...\n');

        // 查询最新的5条记录
        const latestRecords = await hit_dlts.find({})
            .sort({ ID: -1 })
            .limit(5)
            .toArray();

        console.log('最新5条记录的Issue字段:');
        latestRecords.forEach(r => {
            console.log(`  ID: ${r.ID}, Issue: ${r.Issue}, 类型: ${typeof r.Issue}, 值: "${r.Issue}"`);
        });

        // 测试字符串比较查询
        console.log('\n🔍 测试查询: Issue < "25125"');
        const testQuery1 = await hit_dlts.find({
            Issue: { $lt: "25125" }
        })
        .sort({ ID: -1 })
        .limit(5)
        .toArray();

        console.log(`  结果: ${testQuery1.length} 条记录`);
        if (testQuery1.length > 0) {
            testQuery1.forEach(r => {
                console.log(`    ID: ${r.ID}, Issue: ${r.Issue}`);
            });
        } else {
            console.log('  ❌ 无结果！');
        }

        // 测试数值比较查询
        console.log('\n🔍 测试查询: Issue < 25125 (数值)');
        const testQuery2 = await hit_dlts.find({
            Issue: { $lt: 25125 }
        })
        .sort({ ID: -1 })
        .limit(5)
        .toArray();

        console.log(`  结果: ${testQuery2.length} 条记录`);
        if (testQuery2.length > 0) {
            testQuery2.forEach(r => {
                console.log(`    ID: ${r.ID}, Issue: ${r.Issue}`);
            });
        }

        // 测试精确匹配
        console.log('\n🔍 测试查询: Issue = "25124"');
        const testQuery3 = await hit_dlts.findOne({ Issue: "25124" });
        console.log(`  结果: ${testQuery3 ? `ID=${testQuery3.ID}` : '无记录'}`);

        console.log('\n🔍 测试查询: Issue = 25124 (数值)');
        const testQuery4 = await hit_dlts.findOne({ Issue: 25124 });
        console.log(`  结果: ${testQuery4 ? `ID=${testQuery4.ID}` : '无记录'}`);

        // 查看数据库中实际的Issue值范围
        console.log('\n📊 数据库Issue范围:');
        const minIssue = await hit_dlts.findOne({}).sort({ ID: 1 });
        const maxIssue = await hit_dlts.findOne({}).sort({ ID: -1 });
        console.log(`  最小: ${minIssue.Issue} (ID=${minIssue.ID})`);
        console.log(`  最大: ${maxIssue.Issue} (ID=${maxIssue.ID})`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

diagnoseIssueType();
