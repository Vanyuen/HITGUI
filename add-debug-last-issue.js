/**
 * 添加 DEBUG-LAST-ISSUE 调试日志
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 检查是否已存在
if (content.includes('DEBUG-LAST-ISSUE')) {
  console.log('⏭️ DEBUG-LAST-ISSUE调试日志已存在');
  process.exit(0);
}

// 查找插入点：在 const { issue: targetIssue, id: targetID } = issueToIDArray[i]; 后面
// 使用正则表达式匹配
const pattern = /(const \{ issue: targetIssue, id: targetID \} = issueToIDArray\[i\];)\s*\n(\s*\/\/ 🐛 BUG修复 2025-12-11: 统一使用ID-1规则确定baseIssue)/;

const match = content.match(pattern);

if (!match) {
  console.log('⚠️ 未找到插入点');

  // 尝试更宽松的搜索
  const simplePattern = /issueToIDArray\[i\];[\s\S]*?BUG修复 2025-12-11/;
  const simpleMatch = content.match(simplePattern);
  if (simpleMatch) {
    console.log('找到相关代码片段:');
    console.log(simpleMatch[0].substring(0, 200));
  }
  process.exit(1);
}

const debugBlock = `$1

            // 🔍 2025-12-13调试: 为批次最后一期添加详细日志
            if (i === issueToIDArray.length - 1) {
                log(\`  📍 DEBUG-LAST-ISSUE: ⚡ 处理批次最后一期 i=\${i}, targetIssue=\${targetIssue}, targetID=\${targetID}\`);
                log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
                if (targetID !== null) {
                    const debugBaseRec = this.idToRecordMap?.get(targetID - 1);
                    log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap.get(\${targetID - 1})=\${debugBaseRec ? \`Issue \${debugBaseRec.Issue}\` : '不存在!'}\`);
                }
            }

$2`;

content = content.replace(pattern, debugBlock);

fs.writeFileSync(serverPath, content, 'utf8');
console.log('✅ 已添加DEBUG-LAST-ISSUE调试日志');
