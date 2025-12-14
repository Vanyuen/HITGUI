/**
 * 修复热温冷优化表的排序问题
 * 将 sort({ target_issue: -1 }) 改为 sort({ target_id: -1 })
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `const hwcLatest = await DLTRedCombinationsHotWarmColdOptimized
            .findOne({ 'hit_analysis.is_drawn': true })
            .sort({ target_issue: -1 })
            .select('target_issue')
            .lean();`;

const newCode = `const hwcLatest = await DLTRedCombinationsHotWarmColdOptimized
            .findOne({ 'hit_analysis.is_drawn': true })
            .sort({ target_id: -1 })  // 修复: 使用数值类型的 target_id 排序
            .select('target_issue target_id')
            .lean();`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 已修复热温冷优化表排序问题');
    console.log('   sort({ target_issue: -1 }) → sort({ target_id: -1 })');
} else {
    console.log('❌ 未找到目标代码，可能已修复或格式不匹配');
}
