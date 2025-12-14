/**
 * 应用调试日志 - 使用更健壮的方式
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');
let modified = false;

// 调试日志块1: processBatch开始时的缓存检查
const debugBlock1 = `
        // 🔍 2025-12-13调试: processBatch开始时验证缓存状态
        log(\`  📍 DEBUG-BATCH-START: 批次[\${issuesBatch[0]}-\${issuesBatch[issuesBatch.length-1]}] 开始处理\`);
        log(\`  📍 DEBUG-BATCH-START: hwcOptimizedCache大小=\${this.hwcOptimizedCache?.size || 0}\`);
        log(\`  📍 DEBUG-BATCH-START: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
        log(\`  📍 DEBUG-BATCH-START: issueToIdMap大小=\${this.issueToIdMap?.size || 0}\`);
        const lastIssueDbg = issuesBatch[issuesBatch.length - 1].toString();
        const lastIdDbg = this.issueToIdMap?.get(lastIssueDbg);
        log(\`  📍 DEBUG-BATCH-START: 批次最后期号=\${lastIssueDbg}, ID=\${lastIdDbg}\`);
        if (lastIdDbg) {
            const baseDbg = this.idToRecordMap?.get(lastIdDbg - 1);
            log(\`  📍 DEBUG-BATCH-START: 最后期号的ID-1(\${lastIdDbg - 1})记录: \${baseDbg ? \`Issue \${baseDbg.Issue}\` : '不存在!'}\`);
        }

`;

// 查找并插入调试日志
const marker1 = '// 🐛 BUG修复 2025-11-29: 验证关键缓存是否已初始化';
if (content.includes(marker1) && !content.includes('DEBUG-BATCH-START')) {
  content = content.replace(marker1, debugBlock1 + marker1);
  modified = true;
  console.log('✅ 已添加DEBUG-BATCH-START调试日志');
} else if (content.includes('DEBUG-BATCH-START')) {
  console.log('⏭️ DEBUG-BATCH-START调试日志已存在');
} else {
  console.log('⚠️ 未找到marker1');
}

// 调试日志块2: 在for循环开始处
const marker2 = 'for (let i = 0; i < issueToIDArray.length; i++) {';
const debugBlock2Before = `
        // 🔍 2025-12-13调试: 循环开始前验证缓存
        log(\`  📍 DEBUG-LOOP-START: 开始循环处理\${issueToIDArray.length}个期号\`);

        `;

if (content.includes(marker2) && !content.includes('DEBUG-LOOP-START')) {
  content = content.replace(marker2, debugBlock2Before + marker2);
  modified = true;
  console.log('✅ 已添加DEBUG-LOOP-START调试日志');
} else if (content.includes('DEBUG-LOOP-START')) {
  console.log('⏭️ DEBUG-LOOP-START调试日志已存在');
}

// 调试日志块3: 在for循环体内部，处理最后一期时
const marker3 = `const { issue: targetIssue, id: targetID } = issueToIDArray[i];

            // 🐛 BUG修复 2025-12-11: 统一使用ID-1规则确定baseIssue`;

const debugBlock3 = `const { issue: targetIssue, id: targetID } = issueToIDArray[i];

            // 🔍 2025-12-13调试: 为批次最后一期添加详细日志
            if (i === issueToIDArray.length - 1) {
                log(\`  📍 DEBUG-LAST-ISSUE: ⚡ 处理批次最后一期 i=\${i}, targetIssue=\${targetIssue}, targetID=\${targetID}\`);
                log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap大小=\${this.idToRecordMap?.size || 0}\`);
                if (targetID !== null) {
                    const debugBaseRec = this.idToRecordMap?.get(targetID - 1);
                    log(\`  📍 DEBUG-LAST-ISSUE: idToRecordMap.get(\${targetID - 1})=\${debugBaseRec ? \`Issue \${debugBaseRec.Issue}\` : '不存在!'}\`);
                }
            }

            // 🐛 BUG修复 2025-12-11: 统一使用ID-1规则确定baseIssue`;

if (content.includes(marker3) && !content.includes('DEBUG-LAST-ISSUE')) {
  content = content.replace(marker3, debugBlock3);
  modified = true;
  console.log('✅ 已添加DEBUG-LAST-ISSUE调试日志');
} else if (content.includes('DEBUG-LAST-ISSUE')) {
  console.log('⏭️ DEBUG-LAST-ISSUE调试日志已存在');
} else {
  console.log('⚠️ 未找到marker3');
}

// 写回文件
if (modified) {
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('\n✅ 调试日志已成功应用到 server.js');
} else {
  console.log('\n⚠️ 未进行任何修改');
}

console.log('\n📌 添加的调试日志标签:');
console.log('  - DEBUG-BATCH-START: processBatch开始时的缓存状态');
console.log('  - DEBUG-LOOP-START: 循环开始前的验证');
console.log('  - DEBUG-LAST-ISSUE: 批次最后一期的处理详情');
console.log('\n运行任务后，在控制台搜索这些标签可以追踪问题。');
