/**
 * 诊断"最近N期"推算标记BUG
 * 确认数据库中的真实最新期号
 */

const mongoose = require('mongoose');

// MongoDB连接
const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义Schema
const HIT_DLT_Schema = new mongoose.Schema({
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number,
}, { collection: 'hit_dlts' });

const HIT_DLT = mongoose.model('HIT_DLT_Diagnosis', HIT_DLT_Schema);

async function diagnose() {
    try {
        console.log('🔌 连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 1. 获取数据库中最新的10条记录（按Issue降序）
        console.log('📊 查询数据库最新10条记录（按Issue降序）:');
        const latest10 = await HIT_DLT.find({})
            .sort({ Issue: -1 })
            .limit(10)
            .select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2')
            .lean();

        latest10.forEach((record, index) => {
            const redBalls = `${String(record.Red1).padStart(2, '0')} ${String(record.Red2).padStart(2, '0')} ${String(record.Red3).padStart(2, '0')} ${String(record.Red4).padStart(2, '0')} ${String(record.Red5).padStart(2, '0')}`;
            const blueBalls = `${String(record.Blue1).padStart(2, '0')} ${String(record.Blue2).padStart(2, '0')}`;
            console.log(`  ${index + 1}. 期号 ${record.Issue}: ${redBalls} + ${blueBalls}`);
        });

        // 2. 确认绝对最新期号
        const absoluteLatest = latest10[0];
        console.log(`\n🎯 数据库绝对最新期号: ${absoluteLatest.Issue}`);

        // 3. 检查25115-25125范围内的数据
        console.log('\n📋 检查期号范围 25115-25125:');
        for (let issue = 25115; issue <= 25125; issue++) {
            const record = await HIT_DLT.findOne({ Issue: issue })
                .select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2')
                .lean();

            if (record) {
                const redBalls = `${String(record.Red1).padStart(2, '0')} ${String(record.Red2).padStart(2, '0')} ${String(record.Red3).padStart(2, '0')} ${String(record.Red4).padStart(2, '0')} ${String(record.Red5).padStart(2, '0')}`;
                const blueBalls = `${String(record.Blue1).padStart(2, '0')} ${String(record.Blue2).padStart(2, '0')}`;
                console.log(`  ✅ ${issue}: ${redBalls} + ${blueBalls} (已开奖)`);
            } else {
                console.log(`  ❌ ${issue}: 未开奖（数据库中不存在）`);
            }
        }

        // 4. 模拟"最近10期"逻辑
        console.log('\n🔄 模拟"最近10期"逻辑:');
        const recentCount = 10;
        const recentData = await HIT_DLT.find({})
            .sort({ Issue: -1 })
            .limit(recentCount)
            .select('Issue')
            .lean();

        const issues = recentData.map(r => r.Issue).reverse();
        console.log(`  返回期号: ${issues.join(', ')}`);
        console.log(`  期号数量: ${issues.length}`);
        console.log(`  范围: ${issues[0]} - ${issues[issues.length - 1]}`);

        // 5. 推算下一期
        const nextIssue = absoluteLatest.Issue + 1;
        console.log(`  推算下一期: ${nextIssue}`);
        console.log(`  应该返回: ${issues.join(', ')}, ${nextIssue} (共${issues.length + 1}期)`);

        // 6. 检查错误标记逻辑
        console.log('\n❌ BUG模拟 - 使用错误的判断逻辑:');
        const latestIssue = absoluteLatest.Issue;
        issues.push(nextIssue.toString()); // 加入推算期

        issues.forEach(issue => {
            const isPredicted = parseInt(issue) > latestIssue;
            const label = isPredicted ? '❌ 推算' : '✅ 已开奖';
            console.log(`  期号 ${issue}: ${label} (判断: ${issue} > ${latestIssue} = ${isPredicted})`);
        });

        console.log('\n💡 结论:');
        console.log('  1. 如果25115-25124都已开奖，但被标记为"推算"，说明latestIssue获取有误');
        console.log('  2. 应该用数据库实际存在性判断，而非简单的数值比较');
        console.log('  3. 建议使用: const exists = await HIT_DLT.findOne({ Issue: targetIssue })');

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

diagnose();
