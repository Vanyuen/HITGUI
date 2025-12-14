/**
 * 修复脚本：为推算期生成期号对
 * BUG修复 2025-12-11
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 检查是否已经修复过
if (content.includes('🐛 BUG修复 2025-12-11: 为推算期生成期号对')) {
    console.log('⚠️ 代码已经包含此修复，跳过...');
    process.exit(0);
}

// 查找第二个匹配位置的上下文
const searchStr = '共生成${issuePairs.length}个期号对';
let idx = content.indexOf(searchStr);
idx = content.indexOf(searchStr, idx + 1); // 找第二个

if (idx === -1) {
    console.log('❌ 无法找到第二个匹配位置');
    process.exit(1);
}

// 找到要替换的完整行
const lineStart = content.lastIndexOf('\n', idx) + 1;
const lineEnd = content.indexOf('\n', idx);
const originalLine = content.substring(lineStart, lineEnd);

console.log('找到原始行:', originalLine);

// 新代码块
const newCode = `
        // 🐛 BUG修复 2025-12-11: 为推算期生成期号对
        // 问题：推算期不在数据库中，不会被issueRecords包含，导致HWC缓存不会预加载
        // 解决：识别推算期，手动生成期号对（使用最大已开奖期号作为基准）
        const existingIssueNums = new Set(issueRecords.map(r => r.Issue));
        const predictedIssues = issueNumbers.filter(num => !existingIssueNums.has(num));

        if (predictedIssues.length > 0) {
            log(\`  🔮 检测到\${predictedIssues.length}个推算期: \${predictedIssues.join(', ')}\`);

            // 获取数据库中最大的期号作为基准
            const maxExistingIssue = Math.max(...Array.from(existingIssueNums));
            const maxRecord = allRecords.find(r => r.Issue === maxExistingIssue);

            if (maxRecord) {
                for (const predictedIssue of predictedIssues) {
                    // 推算期使用最大已开奖期号作为基准
                    issuePairs.push({
                        base_issue: maxRecord.Issue.toString(),
                        target_issue: predictedIssue.toString()
                    });
                    log(\`  🔮 推算期期号对: \${maxRecord.Issue}→\${predictedIssue}\`);
                }
            } else {
                log(\`  ⚠️ 无法找到最大已开奖期号，推算期将使用fallback计算\`);
            }
        }

        log(\`  ✅ 共生成\${issuePairs.length}个期号对 (含\${predictedIssues.length}个推算期)\`);`;

// 替换：将原始行替换为新代码块
content = content.substring(0, lineStart) + newCode + content.substring(lineEnd);

// 写回文件
fs.writeFileSync(serverPath, content, 'utf8');

console.log('✅ 修复已成功应用！');
console.log('修改位置: HwcPositivePredictor.preloadData()');
console.log('修改内容: 为推算期生成期号对，确保HWC缓存能够预加载');
