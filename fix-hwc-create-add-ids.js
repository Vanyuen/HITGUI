/**
 * 修改 HWC 表 .create() 调用，添加 target_id 和 base_id 字段
 */
const fs = require('fs');

const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');
let modifiedCount = 0;

// 修改1: 已开奖期HWC记录创建 (约28773行)
const oldCode1 = `// 保存到数据库
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: baseIssueStr,
                    target_issue: targetIssueStr,
                    hot_warm_cold_data: hotWarmColdData,
                    total_combinations: allRedCombinations.length,
                    hit_analysis: {
                        target_winning_reds: [targetIssue.Red1, targetIssue.Red2, targetIssue.Red3, targetIssue.Red4, targetIssue.Red5],
                        target_winning_blues: [targetIssue.Blue1, targetIssue.Blue2],
                        red_hit_data: {},
                        hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
                        is_drawn: true
                    },
                    statistics: { ratio_counts: ratioCounts }
                });`;

const newCode1 = `// 保存到数据库
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: baseIssueStr,
                    target_issue: targetIssueStr,
                    base_id: baseIssue.ID,      // 🆕 添加 base_id
                    target_id: targetIssue.ID,  // 🆕 添加 target_id
                    hot_warm_cold_data: hotWarmColdData,
                    total_combinations: allRedCombinations.length,
                    hit_analysis: {
                        target_winning_reds: [targetIssue.Red1, targetIssue.Red2, targetIssue.Red3, targetIssue.Red4, targetIssue.Red5],
                        target_winning_blues: [targetIssue.Blue1, targetIssue.Blue2],
                        red_hit_data: {},
                        hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
                        is_drawn: true
                    },
                    statistics: { ratio_counts: ratioCounts }
                });`;

if (content.includes(oldCode1)) {
    content = content.replace(oldCode1, newCode1);
    console.log('✅ 修改1: 已开奖期HWC记录创建 - 已添加 base_id 和 target_id');
    modifiedCount++;
} else if (content.includes(newCode1)) {
    console.log('✅ 修改1: 已经是最新版本');
} else {
    console.log('❌ 修改1: 未找到目标代码');
}

// 修改2: 推算期HWC记录创建 (约28862行)
const oldCode2 = `// 保存推算期数据
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: baseIssueForPrediction.Issue.toString(),
                    target_issue: predictedIssueNum.toString(),
                    hot_warm_cold_data: hotWarmColdData,
                    total_combinations: allRedCombinations.length,
                    hit_analysis: {
                        target_winning_reds: [],      // ⭐ 推算期为空
                        target_winning_blues: [],     // ⭐ 推算期为空
                        red_hit_data: {},
                        hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
                        is_drawn: false              // ⭐ 推算期标记
                    },
                    statistics: { ratio_counts: ratioCounts }
                });`;

const newCode2 = `// 保存推算期数据
                await DLTRedCombinationsHotWarmColdOptimized.create({
                    base_issue: baseIssueForPrediction.Issue.toString(),
                    target_issue: predictedIssueNum.toString(),
                    base_id: baseIssueForPrediction.ID,  // 🆕 添加 base_id
                    target_id: null,                     // 🆕 推算期 target_id 为 null（因为还没开奖）
                    hot_warm_cold_data: hotWarmColdData,
                    total_combinations: allRedCombinations.length,
                    hit_analysis: {
                        target_winning_reds: [],      // ⭐ 推算期为空
                        target_winning_blues: [],     // ⭐ 推算期为空
                        red_hit_data: {},
                        hit_statistics: { hit_0: 0, hit_1: 0, hit_2: 0, hit_3: 0, hit_4: 0, hit_5: 0 },
                        is_drawn: false              // ⭐ 推算期标记
                    },
                    statistics: { ratio_counts: ratioCounts }
                });`;

if (content.includes(oldCode2)) {
    content = content.replace(oldCode2, newCode2);
    console.log('✅ 修改2: 推算期HWC记录创建 - 已添加 base_id 和 target_id');
    modifiedCount++;
} else if (content.includes(newCode2)) {
    console.log('✅ 修改2: 已经是最新版本');
} else {
    console.log('❌ 修改2: 未找到目标代码');
}

// 保存文件
if (modifiedCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\n✅ 文件已保存，共修改 ' + modifiedCount + ' 处');
} else {
    console.log('\n⚠️ 未做任何修改');
}
