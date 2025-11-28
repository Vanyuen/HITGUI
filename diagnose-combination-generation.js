/**
 * 大乐透组合生成诊断脚本
 * 帮助定位为什么没有生成组合数据
 */
const mongoose = require('mongoose');
const { log } = require('console');

async function diagnosteCombinationGeneration(startIssue, endIssue) {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log(`🔍 诊断组合生成 期号范围: ${startIssue} - ${endIssue}`);

    try {
        // 1. 检查目标期号是否存在于主数据表
        const dltSchema = new mongoose.Schema({ Issue: Number });
        const DLT = mongoose.model('DLT', dltSchema, 'hit_dlts');

        const existingIssues = await DLT.find({
            Issue: {
                $gte: parseInt(startIssue),
                $lte: parseInt(endIssue)
            }
        }).select('Issue');

        console.log('✅ 主数据表中已开奖期号:');
        existingIssues.forEach(issue => console.log(`  - ${issue.Issue}`));

        // 2. 检查是否有缓存的组合
        const cacheSchema = new mongoose.Schema({
            base_issue: String,
            target_issue: String,
            combination_count: Number
        });
        const DLTPeriodCache = mongoose.model('DLTPeriodCache', cacheSchema, 'hit_dlt_periodcombinationcaches');

        const cachedCombos = await DLTPeriodCache.find({
            base_issue: { $gte: startIssue, $lte: endIssue },
            combination_count: { $gt: 0 }
        });

        console.log('\n🗃️ 期号组合缓存:');
        if (cachedCombos.length) {
            cachedCombos.forEach(cache => {
                console.log(`  - 基准期: ${cache.base_issue}, 目标期: ${cache.target_issue}, 组合数: ${cache.combination_count}`);
            });
        } else {
            console.log('  ❌ 未找到任何缓存组合');
        }

        // 3. 检查组合表中的数据
        const comboSchema = new mongoose.Schema({
            base_issue: String,
            target_issue: String
        });
        const DLTCombos = mongoose.model('DLTCombos', comboSchema, 'hit_dlt_redcombinations');

        const combos = await DLTCombos.find({
            base_issue: { $gte: startIssue, $lte: endIssue }
        });

        console.log('\n📊 红球组合表:');
        if (combos.length) {
            console.log(`  ✅ 找到 ${combos.length} 个组合`);
        } else {
            console.log('  ❌ 未找到任何组合');
        }

    } catch (error) {
        console.error('❌ 诊断过程出错:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// 可以直接运行并传入期号范围
if (require.main === module) {
    const startIssue = process.argv[2] || '25115';
    const endIssue = process.argv[3] || '25125';
    diagnosteCombinationGeneration(startIssue, endIssue);
}

module.exports = diagnosteCombinationGeneration;