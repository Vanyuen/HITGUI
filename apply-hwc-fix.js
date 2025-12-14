/**
 * 修复热温冷优化表增量更新的两个BUG
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverPath, 'utf-8');

// ===== 修复1：字符串排序BUG =====
const sortPattern = /const latestOptimizedRecord = await DLTRedCombinationsHotWarmColdOptimized\s*\r?\n\s*\.findOne\(\{ 'hit_analysis\.is_drawn': true \}\)\s*\r?\n\s*\.sort\(\{ target_issue: -1 \}\)\s*\r?\n\s*\.select\('target_issue'\)\s*\r?\n\s*\.lean\(\);/;

const newSortCode = `// ⭐ 修复BUG：使用聚合管道将字符串转为数字后排序，避免字典序排序问题
        const latestOptimizedRecords = await DLTRedCombinationsHotWarmColdOptimized.aggregate([
            { $match: { 'hit_analysis.is_drawn': true } },
            { $addFields: { target_issue_num: { $toInt: '$target_issue' } } },
            { $sort: { target_issue_num: -1 } },
            { $limit: 1 },
            { $project: { target_issue: 1 } }
        ]);
        const latestOptimizedRecord = latestOptimizedRecords[0] || null;`;

if (sortPattern.test(content)) {
    content = content.replace(sortPattern, newSortCode);
    console.log('✅ 修复1：字符串排序BUG已修复');
} else {
    console.log('⚠️  修复1：未找到匹配的排序代码');
}

// ===== 修复2：create改为findOneAndUpdate + upsert =====
const createPattern = /\/\/ 保存到数据库\s*\r?\n\s*await DLTRedCombinationsHotWarmColdOptimized\.create\(\{[\s\S]*?statistics: \{ ratio_counts: ratioCounts \}\s*\r?\n\s*\}\);/;

const newCreateCode = `// 保存到数据库 - 使用upsert避免重复键错误
                await DLTRedCombinationsHotWarmColdOptimized.findOneAndUpdate(
                    { base_issue: baseIssueStr, target_issue: targetIssueStr },
                    {
                        $set: {
                            hot_warm_cold_data: hotWarmColdData,
                            total_combinations: allRedCombinations.length,
                            hit_analysis: {
                                target_winning_reds: [targetIssue.Red1, targetIssue.Red2, targetIssue.Red3, targetIssue.Red4, targetIssue.Red5],
                                target_winning_blues: [targetIssue.Blue1, targetIssue.Blue2],
                                red_hit_data: {},
                                hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
                                is_drawn: true
                            },
                            statistics: { ratio_counts: ratioCounts },
                            updated_at: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );`;

if (createPattern.test(content)) {
    content = content.replace(createPattern, newCreateCode);
    console.log('✅ 修复2：create改为findOneAndUpdate + upsert已完成');
} else {
    console.log('⚠️  修复2：未找到匹配的create代码');
}

fs.writeFileSync(serverPath, content, 'utf-8');
console.log('\n✅ 脚本执行完成！');
