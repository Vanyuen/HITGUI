/**
 * 修复脚本：为第一分支(Branch 1)添加推算期处理逻辑
 * BUG修复 2025-12-11
 *
 * 问题：preloadData有两个分支，第二分支已修复，但第一分支仍缺少推算期处理
 * 解决：为第一分支添加与第二分支相同的推算期处理逻辑
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 检查是否已经修复过
if (content.includes('🐛 BUG修复 2025-12-11 (Branch 1): 为推算期生成期号对')) {
    console.log('⚠️ Branch 1 已经包含此修复，跳过...');
    process.exit(0);
}

// 查找第一个分支的特征代码（注意：这是第一处，不是第二处）
// 第一分支在 line 16667 左右，特征是没有 "(含${predictedIssues.length}个推算期)" 的 log 语句
const searchPattern = 'log(`  ✅ 共生成${issuePairs.length}个期号对`);';

// 找到第一个匹配位置
const idx = content.indexOf(searchPattern);

if (idx === -1) {
    console.log('❌ 无法找到第一分支的特征代码');
    process.exit(1);
}

// 确认这是第一分支（后面应该紧跟 "if (issuePairs.length > 0)"）
const afterContext = content.substring(idx, idx + 200);
if (!afterContext.includes('if (issuePairs.length > 0)')) {
    console.log('❌ 找到的位置不是第一分支，请手动检查');
    console.log('上下文:', afterContext);
    process.exit(1);
}

console.log('✅ 找到第一分支位置，字符位置:', idx);

// 新代码：替换原来的简单 log 语句，添加推算期处理逻辑
const newCode = `// 🐛 BUG修复 2025-12-11 (Branch 1): 为推算期生成期号对
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

// 执行替换
content = content.replace(searchPattern, newCode);

// 写回文件
fs.writeFileSync(serverPath, content, 'utf8');

console.log('✅ Branch 1 修复已成功应用！');
console.log('修改位置: HwcPositivePredictor.preloadData() - 第一分支');
console.log('修改内容: 为推算期生成期号对，确保HWC缓存能够预加载');
console.log('');
console.log('⚠️ 重要: 请重启服务器以使修复生效！');
console.log('   npm start 或手动重启');
