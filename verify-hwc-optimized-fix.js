/**
 * 验证热温冷比优化表修复效果
 * 检查：
 * 1. BUG修复：期号对关系是否正确（使用ID-1）
 * 2. 推算期支持：是否生成了推算期数据
 * 3. 数据完整性：记录数是否符合预期
 */

const mongoose = require('mongoose');

async function verifyHWCOptimizedTable() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        // Schema定义
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'HIT_DLT_RedCombinationsHotWarmColdOptimized',
            new mongoose.Schema({}, { strict: false })
        );

        const hit_dlts = mongoose.model(
            'hit_dlts',
            new mongoose.Schema({}, { strict: false })
        );

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🔍 验证热温冷比优化表修复效果');
        console.log('═══════════════════════════════════════════════════════════════\n');

        // ========== 1. 统计总体数据 ==========
        console.log('📊 【1/5】统计总体数据\n');

        const dltCount = await hit_dlts.countDocuments();
        console.log(`   已开奖期数: ${dltCount}`);

        const totalCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`   优化表总记录数: ${totalCount}`);

        const drawnCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments({
            'hit_analysis.is_drawn': true
        });
        console.log(`   已开奖期记录: ${drawnCount}`);

        const predictedCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments({
            'hit_analysis.is_drawn': false
        });
        console.log(`   推算期记录: ${predictedCount}`);

        const expectedCount = dltCount; // 已开奖期数-1 + 推算期1 = 已开奖期数
        const isCountCorrect = totalCount === expectedCount;
        console.log(`   期望记录数: ${expectedCount} (${dltCount - 1}已开奖 + 1推算期)`);
        console.log(`   ${isCountCorrect ? '✅' : '❌'} 记录数验证: ${isCountCorrect ? '通过' : '失败'}\n`);

        // ========== 2. 验证推算期数据 ==========
        console.log('📊 【2/5】验证推算期数据\n');

        const latestDLT = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('Issue').lean();
        const latestIssue = latestDLT ? latestDLT.Issue : 0;
        const expectedPredictedIssue = latestIssue + 1;

        console.log(`   最新已开奖期: ${latestIssue}`);
        console.log(`   期望推算期: ${expectedPredictedIssue}`);

        const predictedRecords = await DLTRedCombinationsHotWarmColdOptimized.find({
            'hit_analysis.is_drawn': false
        }).select('base_issue target_issue hit_analysis.target_winning_reds hit_analysis.target_winning_blues').lean();

        if (predictedRecords.length === 0) {
            console.log('   ❌ 未找到推算期数据！\n');
        } else if (predictedRecords.length > 1) {
            console.log(`   ⚠️  推算期记录数异常: ${predictedRecords.length} 条（期望1条）\n`);
            predictedRecords.forEach((record, index) => {
                console.log(`   记录${index + 1}: ${record.base_issue} → ${record.target_issue}`);
            });
        } else {
            const record = predictedRecords[0];
            console.log(`   ✅ 找到推算期数据: ${record.base_issue} → ${record.target_issue}`);
            console.log(`   期号验证: ${parseInt(record.target_issue) === expectedPredictedIssue ? '✅ 正确' : '❌ 错误'}`);
            console.log(`   开奖红球: ${record.hit_analysis.target_winning_reds.length === 0 ? '✅ 空（正确）' : '❌ 不为空'}`);
            console.log(`   开奖蓝球: ${record.hit_analysis.target_winning_blues.length === 0 ? '✅ 空（正确）' : '❌ 不为空'}\n`);
        }

        // ========== 3. 验证期号对关系（BUG修复验证）==========
        console.log('📊 【3/5】验证期号对关系（BUG修复验证）\n');

        const allRecords = await DLTRedCombinationsHotWarmColdOptimized.find({
            'hit_analysis.is_drawn': true
        }).sort({ target_issue: 1 }).select('base_issue target_issue').lean();

        console.log(`   检查前10条记录的期号对关系...\n`);

        let bugCount = 0;
        for (let i = 0; i < Math.min(10, allRecords.length); i++) {
            const record = allRecords[i];
            const baseIssue = parseInt(record.base_issue);
            const targetIssue = parseInt(record.target_issue);

            // 查询target_issue的真正上一期（通过ID-1）
            const targetDLT = await hit_dlts.findOne({ Issue: targetIssue }).select('ID Issue').lean();
            if (targetDLT) {
                const truePreviousDLT = await hit_dlts.findOne({ ID: targetDLT.ID - 1 }).select('Issue').lean();
                const truePreviousIssue = truePreviousDLT ? truePreviousDLT.Issue : null;

                const isCorrect = baseIssue === truePreviousIssue;
                if (!isCorrect) bugCount++;

                console.log(`   ${i + 1}. ${record.base_issue} → ${record.target_issue} ${isCorrect ? '✅' : '❌ BUG'}`);
                if (!isCorrect && truePreviousIssue) {
                    console.log(`      真正的上一期应该是: ${truePreviousIssue}`);
                }
            }
        }

        console.log(`\n   ${bugCount === 0 ? '✅' : '❌'} BUG验证: ${bugCount === 0 ? '未发现问题' : `发现${bugCount}个错误`}\n`);

        // ========== 4. 验证热温冷比数据结构 ==========
        console.log('📊 【4/5】验证热温冷比数据结构\n');

        const sampleRecord = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            'hit_analysis.is_drawn': true
        }).lean();

        if (sampleRecord) {
            console.log(`   样本记录: ${sampleRecord.base_issue} → ${sampleRecord.target_issue}`);
            console.log(`   热温冷比种类数: ${Object.keys(sampleRecord.hot_warm_cold_data).length}`);
            console.log(`   总组合数: ${sampleRecord.total_combinations}`);

            // 验证组合数总和
            let totalCombos = 0;
            for (const [ratio, combos] of Object.entries(sampleRecord.hot_warm_cold_data)) {
                totalCombos += combos.length;
            }
            const isSumCorrect = totalCombos === sampleRecord.total_combinations;
            console.log(`   组合数总和: ${totalCombos} ${isSumCorrect ? '✅' : '❌'}`);

            // 列出前5种热温冷比
            console.log('\n   前5种热温冷比:');
            const ratios = Object.keys(sampleRecord.hot_warm_cold_data).slice(0, 5);
            ratios.forEach(ratio => {
                const count = sampleRecord.hot_warm_cold_data[ratio].length;
                console.log(`     ${ratio}: ${count} 个组合`);
            });
            console.log('');
        } else {
            console.log('   ⚠️  未找到已开奖期的样本记录\n');
        }

        // ========== 5. 生成验证报告 ==========
        console.log('📊 【5/5】验证报告\n');

        const allPassed =
            isCountCorrect &&
            predictedRecords.length === 1 &&
            parseInt(predictedRecords[0].target_issue) === expectedPredictedIssue &&
            bugCount === 0;

        console.log('═══════════════════════════════════════════════════════════════');
        if (allPassed) {
            console.log('✅ 验证通过！所有修复均已生效：');
            console.log('   ✅ 记录数正确（包含推算期）');
            console.log('   ✅ 推算期数据生成正确');
            console.log('   ✅ 期号对关系正确（BUG已修复）');
        } else {
            console.log('⚠️  验证发现问题：');
            if (!isCountCorrect) {
                console.log(`   ❌ 记录数不正确: 期望${expectedCount}条, 实际${totalCount}条`);
            }
            if (predictedRecords.length !== 1) {
                console.log(`   ❌ 推算期记录数异常: ${predictedRecords.length}条（期望1条）`);
            } else if (parseInt(predictedRecords[0].target_issue) !== expectedPredictedIssue) {
                console.log(`   ❌ 推算期号错误: ${predictedRecords[0].target_issue}（期望${expectedPredictedIssue}）`);
            }
            if (bugCount > 0) {
                console.log(`   ❌ 期号对关系错误: 发现${bugCount}个BUG`);
            }
        }
        console.log('═══════════════════════════════════════════════════════════════\n');

        await mongoose.disconnect();
        console.log('✅ 已断开MongoDB连接');

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.error(error.stack);
        await mongoose.disconnect();
        process.exit(1);
    }
}

verifyHWCOptimizedTable();
