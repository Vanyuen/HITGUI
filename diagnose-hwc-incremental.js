/**
 * 诊断热温冷优化表增量更新问题
 * 问题：增量更新耗时150.7秒却新建0条记录
 */

const mongoose = require('mongoose');

async function diagnose() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 诊断热温冷优化表增量更新问题');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;

        // 1. 检查 hit_dlts 表最新期号
        console.log('【1】检查 hit_dlts 表最新期号');
        const latestDrawn = await db.collection('hit_dlts')
            .find({})
            .sort({ Issue: -1 })
            .limit(5)
            .toArray();

        console.log('   最近5期开奖数据:');
        latestDrawn.forEach(d => {
            console.log(`   - Issue: ${d.Issue}, ID: ${d.ID}, Red: [${d.Red1},${d.Red2},${d.Red3},${d.Red4},${d.Red5}]`);
        });
        const latestIssue = latestDrawn[0]?.Issue;
        const latestID = latestDrawn[0]?.ID;
        console.log(`\n   📊 最新期号: ${latestIssue} (ID=${latestID})\n`);

        // 2. 检查优化表最新已处理期号
        console.log('【2】检查热温冷优化表最新已处理期号');
        const latestOptimized = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .limit(3)
            .toArray();

        if (latestOptimized.length > 0) {
            console.log('   最新已处理的已开奖期 (is_drawn=true):');
            latestOptimized.forEach(r => {
                console.log(`   - target_issue: ${r.target_issue}, base_issue: ${r.base_issue}`);
            });
            console.log(`\n   📊 优化表最新已处理期: ${latestOptimized[0].target_issue}\n`);
        } else {
            console.log('   ⚠️  优化表中没有已开奖期记录 (is_drawn=true)\n');
        }

        // 3. 检查推算期记录
        console.log('【3】检查热温冷优化表推算期记录');
        const predictedRecords = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({ 'hit_analysis.is_drawn': false })
            .toArray();

        if (predictedRecords.length > 0) {
            console.log(`   推算期记录数: ${predictedRecords.length}`);
            predictedRecords.forEach(r => {
                console.log(`   - target_issue: ${r.target_issue}, base_issue: ${r.base_issue}`);
            });
        } else {
            console.log('   ⚠️  没有推算期记录 (is_drawn=false)\n');
        }

        // 4. 关键诊断：检查遗漏值表
        console.log('\n【4】检查遗漏值表 (hit_dlt_basictrendchart_redballmissing_histories)');
        const missingHistories = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
            .find({})
            .sort({ ID: -1 })
            .limit(5)
            .toArray();

        if (missingHistories.length > 0) {
            console.log(`   遗漏值表最近5条记录:`);
            missingHistories.forEach(r => {
                console.log(`   - ID: ${r.ID}, Issue: ${r.issue || '未知'}`);
            });
            console.log(`\n   📊 遗漏值表最新ID: ${missingHistories[0].ID}\n`);
        } else {
            console.log('   ⚠️  遗漏值表为空！这是根本原因\n');
        }

        // 5. 对比分析
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📋 诊断结论');
        console.log('═══════════════════════════════════════════════════════════════\n');

        const latestProcessedIssue = latestOptimized[0]?.target_issue ?
            parseInt(latestOptimized[0].target_issue) : 0;
        const latestMissingID = missingHistories[0]?.ID || 0;

        console.log(`   hit_dlts 最新期号:      ${latestIssue} (ID=${latestID})`);
        console.log(`   优化表最新已处理期:     ${latestProcessedIssue}`);
        console.log(`   遗漏值表最新ID:         ${latestMissingID}`);
        console.log('');

        // 问题诊断
        if (latestIssue <= latestProcessedIssue) {
            console.log('   🔍 问题原因: hit_dlts最新期号 <= 优化表最新已处理期');
            console.log('      增量更新认为已开奖期数据已是最新，跳过处理');
            console.log('');
            console.log('   💡 解决方案:');
            console.log('      1. 确认hit_dlts确实有新期号数据');
            console.log('      2. 如果新期号已存在但优化表也有，可能是旧推算期已有记录');
        } else if (latestMissingID < latestID) {
            console.log('   🔍 问题原因: 遗漏值表未同步更新');
            console.log(`      hit_dlts最新ID=${latestID}，但遗漏值表最新ID=${latestMissingID}`);
            console.log('');
            console.log('   💡 解决方案:');
            console.log('      需要先更新遗漏值表，再运行热温冷增量更新');
            console.log('      更新顺序: 更新开奖数据 → 更新遗漏值 → 更新热温冷优化表');
        } else {
            console.log('   🔍 数据看起来正常，可能需要检查其他问题');
            console.log('      请检查服务器日志获取更多信息');
        }

        // 6. 额外检查：推算期生成条件
        console.log('\n【6】检查推算期生成条件');
        const predictedIssueNum = latestIssue + 1;
        console.log(`   推算期期号: ${predictedIssueNum}`);
        console.log(`   需要的上一期(Issue-1): ${predictedIssueNum - 1}`);

        const baseForPredicted = await db.collection('hit_dlts')
            .findOne({ Issue: predictedIssueNum - 1 });

        if (baseForPredicted) {
            console.log(`   ✅ 上一期存在: Issue=${baseForPredicted.Issue}, ID=${baseForPredicted.ID}`);

            // 检查该期的遗漏值
            const baseMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
                .findOne({ ID: baseForPredicted.ID });

            if (baseMissing) {
                console.log(`   ✅ 上一期遗漏值存在: ID=${baseMissing.ID}`);
            } else {
                console.log(`   ❌ 上一期遗漏值不存在! 这会导致推算期无法生成`);
            }
        } else {
            console.log(`   ❌ 上一期不存在! 这会导致推算期无法生成`);
        }

        console.log('\n═══════════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ 诊断失败:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
