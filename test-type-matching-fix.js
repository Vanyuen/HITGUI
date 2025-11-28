/**
 * 测试脚本：验证类型不匹配修复
 *
 * 测试所有涉及 Issue 字段的查询，确保使用字符串比较
 */

const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({
    ID: Number,
    Issue: String,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
}, { collection: 'hit_dlts' }));

async function testTypeMatching() {
    try {
        console.log('🧪 测试 Issue 字段类型匹配修复\n');
        console.log('='.repeat(70));

        // 获取最新期号
        const latest = await hit_dlts.findOne({}).sort({ ID: -1 }).lean();
        const latestIssue = parseInt(latest.Issue);
        console.log(`\n📊 数据库最新期号: ${latest.Issue} (ID: ${latest.ID})`);
        console.log(`   类型: ${typeof latest.Issue}`);

        // 测试1：历史数据查询（GlobalCache）
        console.log('\n' + '-'.repeat(70));
        console.log('测试1: 历史数据查询 (GlobalCache)');
        console.log('-'.repeat(70));

        const minTargetIssue = latestIssue + 1;  // 推算期
        console.log(`查询条件: Issue < "${minTargetIssue}" (字符串比较)`);

        const historicalRecords = await hit_dlts.find({
            Issue: { $lt: String(minTargetIssue) }  // ✅ 使用字符串
        })
        .sort({ ID: -1 })
        .limit(10)
        .select('Issue ID')
        .lean();

        console.log(`结果: ${historicalRecords.length} 条记录`);
        if (historicalRecords.length > 0) {
            console.log(`✅ 成功！查询到历史数据`);
            console.log(`   最新: ID=${historicalRecords[0].ID}, Issue=${historicalRecords[0].Issue}`);
        } else {
            console.log(`❌ 失败！未查到历史数据`);
        }

        // 测试2：自定义范围查询
        console.log('\n' + '-'.repeat(70));
        console.log('测试2: 自定义范围查询 (resolveIssueRangeInternal)');
        console.log('-'.repeat(70));

        const startIssue = latestIssue - 5;
        const endIssue = latestIssue;
        console.log(`查询条件: "${startIssue}" <= Issue <= "${endIssue}" (字符串比较)`);

        const customRangeRecords = await hit_dlts.find({
            Issue: {
                $gte: String(startIssue),  // ✅ 使用字符串
                $lte: String(endIssue)     // ✅ 使用字符串
            }
        })
        .sort({ ID: -1 })
        .select('Issue ID')
        .lean();

        console.log(`结果: ${customRangeRecords.length} 条记录`);
        if (customRangeRecords.length > 0) {
            console.log(`✅ 成功！查询到范围数据`);
            console.log(`   范围: ${customRangeRecords[customRangeRecords.length - 1].Issue} ~ ${customRangeRecords[0].Issue}`);
        } else {
            console.log(`❌ 失败！未查到范围数据`);
        }

        // 测试3：$in 查询（期号对生成）
        console.log('\n' + '-'.repeat(70));
        console.log('测试3: $in 查询 (期号对生成)');
        console.log('-'.repeat(70));

        const targetIssues = [String(latestIssue), String(latestIssue - 1), String(latestIssue - 2)];
        console.log(`查询条件: Issue in ${JSON.stringify(targetIssues)} (字符串数组)`);

        const inQueryRecords = await hit_dlts.find({
            Issue: { $in: targetIssues }  // ✅ 使用字符串数组
        })
        .select('Issue ID')
        .lean();

        console.log(`结果: ${inQueryRecords.length} 条记录`);
        if (inQueryRecords.length === targetIssues.length) {
            console.log(`✅ 成功！查询到所有期号`);
            inQueryRecords.forEach(r => {
                console.log(`   ID=${r.ID}, Issue=${r.Issue}`);
            });
        } else {
            console.log(`⚠️ 部分成功：期望${targetIssues.length}条，实际${inQueryRecords.length}条`);
        }

        // 测试4：对比数字查询（应该失败）
        console.log('\n' + '-'.repeat(70));
        console.log('测试4: 数字查询对比（预期失败）');
        console.log('-'.repeat(70));

        console.log(`查询条件: Issue < ${minTargetIssue} (数字比较，错误方式)`);

        const wrongQuery = await hit_dlts.find({
            Issue: { $lt: minTargetIssue }  // ❌ 使用数字（错误）
        })
        .limit(10)
        .lean();

        console.log(`结果: ${wrongQuery.length} 条记录`);
        if (wrongQuery.length === 0) {
            console.log(`✅ 预期结果！数字查询返回0条（因为类型不匹配）`);
        } else {
            console.log(`⚠️ 意外！数字查询居然返回了数据`);
        }

        // 总结
        console.log('\n' + '='.repeat(70));
        console.log('📋 测试总结');
        console.log('='.repeat(70));

        const allTestsPassed =
            historicalRecords.length > 0 &&
            customRangeRecords.length > 0 &&
            inQueryRecords.length === targetIssues.length &&
            wrongQuery.length === 0;

        if (allTestsPassed) {
            console.log('✅ 所有测试通过！类型匹配修复有效。');
            console.log('   - 历史数据查询: ✅');
            console.log('   - 自定义范围查询: ✅');
            console.log('   - $in 查询: ✅');
            console.log('   - 数字查询对比: ✅ (正确返回0条)');
        } else {
            console.log('❌ 部分测试失败，请检查修复');
        }

        console.log('\n💡 修复要点：');
        console.log('   Issue 字段在数据库中存储为 String 类型');
        console.log('   所有查询必须使用字符串: String(value)');
        console.log('   算术运算必须先 parseInt(): parseInt(issue) + 1');

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testTypeMatching();
