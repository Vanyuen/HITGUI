/**
 * 检查 Issue 字段类型和值
 */

const mongoose = require('mongoose');

async function checkIssueType() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;
        const hit_dlts = db.collection('hit_dlts');

        console.log('\n========================================');
        console.log('🔍 检查 Issue 字段类型');
        console.log('========================================');

        // 获取最新10条记录
        const latest10 = await hit_dlts.find({})
            .sort({ ID: -1 })
            .limit(10)
            .toArray();

        console.log('\n最新10期数据（完整字段）:');
        latest10.reverse().forEach((record, idx) => {
            console.log(`\n记录 ${idx + 1}:`);
            console.log(`  ID: ${record.ID} (类型: ${typeof record.ID})`);
            console.log(`  Issue: ${record.Issue} (类型: ${typeof record.Issue})`);
            console.log(`  Issue值 (JSON): ${JSON.stringify(record.Issue)}`);
        });

        // 测试不同类型的查询
        console.log('\n========================================');
        console.log('🔍 测试不同类型的查询');
        console.log('========================================');

        // 1. 数字查询
        const queryNum = await hit_dlts.findOne({ Issue: 25115 });
        console.log(`\n查询 Issue: 25115 (Number): ${queryNum ? '✅ 找到' : '❌ 未找到'}`);
        if (queryNum) {
            console.log(`  ID: ${queryNum.ID}, Issue: ${queryNum.Issue} (${typeof queryNum.Issue})`);
        }

        // 2. 字符串查询
        const queryStr = await hit_dlts.findOne({ Issue: "25115" });
        console.log(`\n查询 Issue: "25115" (String): ${queryStr ? '✅ 找到' : '❌ 未找到'}`);
        if (queryStr) {
            console.log(`  ID: ${queryStr.ID}, Issue: ${queryStr.Issue} (${typeof queryStr.Issue})`);
        }

        // 3. parseInt查询
        const queryParsed = await hit_dlts.findOne({ Issue: parseInt("25115") });
        console.log(`\n查询 Issue: parseInt("25115") (Number): ${queryParsed ? '✅ 找到' : '❌ 未找到'}`);
        if (queryParsed) {
            console.log(`  ID: ${queryParsed.ID}, Issue: ${queryParsed.Issue} (${typeof queryParsed.Issue})`);
        }

        // 4. 范围查询（数字）
        const rangeNum = await hit_dlts.find({
            Issue: { $gte: 25115, $lte: 25120 }
        }).toArray();
        console.log(`\n范围查询 Issue: {$gte: 25115, $lte: 25120} (Number): 找到 ${rangeNum.length} 条`);

        // 5. 范围查询（字符串）
        const rangeStr = await hit_dlts.find({
            Issue: { $gte: "25115", $lte: "25120" }
        }).toArray();
        console.log(`范围查询 Issue: {$gte: "25115", $lte: "25120"} (String): 找到 ${rangeStr.length} 条`);

        // 6. ID范围查询
        const rangeByID = await hit_dlts.find({
            ID: { $gte: 2783, $lte: 2788 }
        }).sort({ ID: 1 }).toArray();
        console.log(`\nID范围查询 {$gte: 2783, $lte: 2788}: 找到 ${rangeByID.length} 条`);
        rangeByID.forEach(r => {
            console.log(`  ID: ${r.ID}, Issue: ${r.Issue} (${typeof r.Issue})`);
        });

        console.log('\n========================================');
        console.log('📝 结论');
        console.log('========================================');

        const firstRecord = latest10[0];
        if (firstRecord) {
            if (typeof firstRecord.Issue === 'string') {
                console.log('\n⚠️ Issue 字段是 String 类型！');
                console.log('   这就是为什么 Issue: 25115 (Number) 查询失败的原因');
                console.log('   必须使用 Issue: "25115" (String) 查询');
            } else if (typeof firstRecord.Issue === 'number') {
                console.log('\n✅ Issue 字段是 Number 类型');
                console.log('   应该可以使用 Issue: 25115 (Number) 查询');
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

checkIssueType();
