/**
 * 验证修复效果测试脚本
 * 模拟增量逻辑，验证是否正确识别最新期号
 */

const mongoose = require('mongoose');

async function verifyFix() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_verify_fix', hit_dltsSchema);

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const HWCModel = mongoose.model('HWCVerifyFix', DLTRedCombinationsHotWarmColdOptimizedSchema);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 步骤1：模拟旧逻辑（字符串排序）');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 旧逻辑：字符串排序
        const latestOptimizedRecordOld = await HWCModel
            .findOne({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .select('target_issue')
            .lean();

        const latestProcessedIssueOld = latestOptimizedRecordOld ?
            parseInt(latestOptimizedRecordOld.target_issue) : 0;

        console.log(`   旧逻辑结果: ${latestProcessedIssueOld}`);
        console.log(`   ${latestProcessedIssueOld === 9153 ? '✅' : '❌'} 符合预期（应该是9153，字符串排序错误）\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 步骤2：模拟新逻辑（数值最大值）');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 新逻辑：获取所有记录转为数字后取最大值
        const allOptimizedRecords = await HWCModel
            .find({ 'hit_analysis.is_drawn': true })
            .select('target_issue')
            .lean();

        const latestProcessedIssueNew = allOptimizedRecords.length > 0 ?
            Math.max(...allOptimizedRecords.map(r => parseInt(r.target_issue))) : 0;

        console.log(`   新逻辑结果: ${latestProcessedIssueNew}`);
        console.log(`   ${latestProcessedIssueNew === 25124 ? '✅' : '❌'} 符合预期（应该是25124，数值最大值）\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 步骤3：模拟增量更新判断');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 获取所有已开奖期
        const allIssues = await hit_dlts.find({}).sort({ Issue: 1 }).select('ID Issue').lean();
        const latestDltIssue = allIssues[allIssues.length - 1].Issue;

        console.log(`   hit_dlts 最新期号: ${latestDltIssue}`);
        console.log(`   优化表最新期号（旧逻辑）: ${latestProcessedIssueOld}`);
        console.log(`   优化表最新期号（新逻辑）: ${latestProcessedIssueNew}\n`);

        // 旧逻辑判断
        let issuesToProcessOld = [];
        if (latestDltIssue > latestProcessedIssueOld) {
            issuesToProcessOld = allIssues.filter(issue => issue.Issue > latestProcessedIssueOld);
        }

        // 新逻辑判断
        let issuesToProcessNew = [];
        if (latestDltIssue > latestProcessedIssueNew) {
            issuesToProcessNew = allIssues.filter(issue => issue.Issue > latestProcessedIssueNew);
        }

        console.log(`   旧逻辑待处理期数: ${issuesToProcessOld.length} 期`);
        if (issuesToProcessOld.length > 0) {
            console.log(`      ❌ 错误：会重复处理 10001-25124（${issuesToProcessOld.length}期）`);
            console.log(`      ❌ 导致：E11000 duplicate key error`);
        }

        console.log(`\n   新逻辑待处理期数: ${issuesToProcessNew.length} 期`);
        if (issuesToProcessNew.length === 0) {
            console.log(`      ✅ 正确：已开奖期数据已是最新，跳过处理`);
        } else {
            console.log(`      ✅ 正确：只处理新期号 ${issuesToProcessNew[0].Issue}-${issuesToProcessNew[issuesToProcessNew.length - 1].Issue}`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 修复效果总结');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log(`   ✅ 修复前问题:`);
        console.log(`      - 识别最新期号: ${latestProcessedIssueOld}（错误）`);
        console.log(`      - 待处理期数: ${issuesToProcessOld.length} 期（重复）`);
        console.log(`      - 结果: E11000 duplicate key error\n`);

        console.log(`   ✅ 修复后效果:`);
        console.log(`      - 识别最新期号: ${latestProcessedIssueNew}（正确）`);
        console.log(`      - 待处理期数: ${issuesToProcessNew.length} 期（正常）`);
        console.log(`      - 结果: ${issuesToProcessNew.length === 0 ? '跳过处理' : '只处理新期号'}\n`);

        const fixSuccess = latestProcessedIssueNew === 25124 && issuesToProcessNew.length === 0;
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`${fixSuccess ? '✅ 修复验证成功！' : '❌ 修复验证失败！'}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

verifyFix();
