/**
 * 检查期号 25114 和 25115 在 hit_dlts 表中是否存在
 */

const mongoose = require('mongoose');

async function checkIssues() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;
        const hit_dlts = db.collection('hit_dlts');

        console.log('\n========================================');
        console.log('🔍 检查期号 25114 和 25115');
        console.log('========================================');

        // 检查期号 25114
        const issue25114 = await hit_dlts.findOne({ Issue: 25114 });
        console.log('\n期号 25114:');
        if (issue25114) {
            console.log(`  ✅ 存在`);
            console.log(`  ID: ${issue25114.ID}`);
            console.log(`  Issue: ${issue25114.Issue}`);
            console.log(`  开奖号码: 红球 ${issue25114.Red?.join(', ')}, 蓝球 ${issue25114.Blue?.join(', ')}`);
        } else {
            console.log(`  ❌ 不存在`);
        }

        // 检查期号 25115
        const issue25115 = await hit_dlts.findOne({ Issue: 25115 });
        console.log('\n期号 25115:');
        if (issue25115) {
            console.log(`  ✅ 存在`);
            console.log(`  ID: ${issue25115.ID}`);
            console.log(`  Issue: ${issue25115.Issue}`);
            console.log(`  开奖号码: 红球 ${issue25115.Red?.join(', ')}, 蓝球 ${issue25115.Blue?.join(', ')}`);
        } else {
            console.log(`  ❌ 不存在`);
        }

        // 查看前后期号
        console.log('\n========================================');
        console.log('📊 查看25114附近的期号分布');
        console.log('========================================');

        const nearbyIssues = await hit_dlts.find({
            Issue: { $gte: 25110, $lte: 25120 }
        })
        .sort({ Issue: 1 })
        .project({ ID: 1, Issue: 1 })
        .toArray();

        console.log('\n期号 25110-25120 范围内的实际数据:');
        nearbyIssues.forEach(record => {
            console.log(`  期号 ${record.Issue}, ID ${record.ID}`);
        });

        // 检查是否有遗漏期号
        console.log('\n========================================');
        console.log('🔍 期号连续性检查');
        console.log('========================================');

        if (nearbyIssues.length > 0) {
            const issues = nearbyIssues.map(r => r.Issue);
            const gaps = [];

            for (let i = 0; i < issues.length - 1; i++) {
                const current = issues[i];
                const next = issues[i + 1];
                const diff = next - current;

                if (diff > 1) {
                    gaps.push({
                        from: current,
                        to: next,
                        missing: Array.from({ length: diff - 1 }, (_, idx) => current + idx + 1)
                    });
                }
            }

            if (gaps.length > 0) {
                console.log('\n⚠️ 发现遗漏期号:');
                gaps.forEach(gap => {
                    console.log(`  ${gap.from} → ${gap.to}: 缺少期号 ${gap.missing.join(', ')}`);
                });
            } else {
                console.log('\n✅ 该范围内期号连续，无遗漏');
            }
        }

        // 检查最新10期的期号
        console.log('\n========================================');
        console.log('📅 最新10期期号列表');
        console.log('========================================');

        const latest10 = await hit_dlts.find({})
            .sort({ ID: -1 })
            .limit(10)
            .project({ ID: 1, Issue: 1 })
            .toArray();

        console.log('\n最新10期（按ID降序）:');
        latest10.reverse().forEach((record, idx) => {
            console.log(`  ${idx + 1}. 期号 ${record.Issue}, ID ${record.ID}`);
        });

        // 分析结论
        console.log('\n========================================');
        console.log('📝 分析结论');
        console.log('========================================');

        if (!issue25114 && !issue25115) {
            console.log('\n❌ 期号 25114 和 25115 均不存在');
            console.log('   结论: 热温冷优化表缺少 25114→25115 是正常的，因为原始数据就没有这两个期号');
            console.log('   建议: 无需补充该期号对的数据');
        } else if (!issue25114 && issue25115) {
            console.log('\n⚠️ 期号 25114 不存在，但 25115 存在');
            console.log('   结论: 无法生成 25114→25115，因为基准期号 25114 不存在');
            console.log('   建议: 期号对应从上一个存在的期号开始生成');
        } else if (issue25114 && !issue25115) {
            console.log('\n⚠️ 期号 25114 存在，但 25115 不存在');
            console.log('   结论: 无法生成 25114→25115，因为目标期号 25115 不存在');
            console.log('   建议: 跳过该期号对');
        } else {
            console.log('\n✅ 期号 25114 和 25115 均存在');
            console.log('   结论: 应该存在 25114→25115 的热温冷优化表数据');
            console.log('   建议: 需要补充生成该期号对的数据');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

checkIssues();
