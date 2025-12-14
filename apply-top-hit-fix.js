/**
 * 修复脚本：top_hit模式详情收集逻辑
 *
 * 问题：top_hit模式在运行时只收集最近N期的详情，
 *       但命中最多的期号可能不在最近N期内，导致无详情可保存
 *
 * 解决：top_hit模式改为运行时收集所有期号的详情，保存时再筛选
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 规范化换行符
const originalLineEnding = content.includes('\r\n') ? '\r\n' : '\n';
content = content.replace(/\r\n/g, '\n');

// 要查找的旧代码
const oldCode = `        // 预计算需要收集详情的期号
        if (detailsMode === 'all') {
            // 全部期号都收集详情
            issuesBatch.forEach(issue => collectDetailsForIssues.add(issue.toString()));
            log(\`📝 [\${this.sessionId}] 排除详情模式: all - 所有\${issuesBatch.length}期都收集详情\`);
        } else if (detailsMode === 'recent' || detailsMode === 'top_hit') {
            // recent模式: 最后N期 + 推算期
            // top_hit模式: 预处理时无法确定命中最多的期号，暂时使用recent逻辑，后续会在任务完成时筛选
            const sortedIssues = [...issuesBatch].sort((a, b) => parseInt(b) - parseInt(a));
            for (let i = 0; i < Math.min(recentCount, sortedIssues.length); i++) {
                collectDetailsForIssues.add(sortedIssues[i].toString());
            }
            log(\`📝 [\${this.sessionId}] 排除详情模式: \${detailsMode} - 预收集最近\${collectDetailsForIssues.size}期详情\`);
        } else if (detailsMode === 'none') {
            // none模式: 仅推算期收集详情（在循环中判断）
            log(\`📝 [\${this.sessionId}] 排除详情模式: none - 仅推算期收集详情\`);
        }`;

// 新代码
const newCode = `        // 预计算需要收集详情的期号
        if (detailsMode === 'all') {
            // 全部期号都收集详情
            issuesBatch.forEach(issue => collectDetailsForIssues.add(issue.toString()));
            log(\`📝 [\${this.sessionId}] 排除详情模式: all - 所有\${issuesBatch.length}期都收集详情\`);
        } else if (detailsMode === 'top_hit') {
            // ⭐ 2025-12-09修复: top_hit模式需要收集所有期号的详情
            // 因为只有任务完成后才知道哪些期号命中最多，保存时再根据命中情况筛选
            issuesBatch.forEach(issue => collectDetailsForIssues.add(issue.toString()));
            log(\`📝 [\${this.sessionId}] 排除详情模式: top_hit - 运行时收集所有\${issuesBatch.length}期详情，保存时按命中筛选\`);
        } else if (detailsMode === 'recent') {
            // recent模式: 最后N期 + 推算期
            const sortedIssues = [...issuesBatch].sort((a, b) => parseInt(b) - parseInt(a));
            for (let i = 0; i < Math.min(recentCount, sortedIssues.length); i++) {
                collectDetailsForIssues.add(sortedIssues[i].toString());
            }
            log(\`📝 [\${this.sessionId}] 排除详情模式: recent - 预收集最近\${collectDetailsForIssues.size}期详情\`);
        } else if (detailsMode === 'none') {
            // none模式: 仅推算期收集详情（在循环中判断）
            log(\`📝 [\${this.sessionId}] 排除详情模式: none - 仅推算期收集详情\`);
        }`;

// 检查是否已经修复
if (content.includes('⭐ 2025-12-09修复: top_hit模式需要收集所有期号的详情')) {
    console.log('✅ 代码已经包含此修复，无需重复修改');
    process.exit(0);
}

// 查找并替换
if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);

    // 恢复原始换行符
    if (originalLineEnding === '\r\n') {
        content = content.replace(/\n/g, '\r\n');
    }

    // 写回文件
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✅ 修复成功！top_hit模式现在会收集所有期号的详情');
    console.log('   修改位置: processBatch() 方法中的详情收集逻辑');
} else {
    console.log('❌ 未找到目标代码块，可能代码已被修改');
    console.log('请手动检查 src/server/server.js 中 processBatch() 方法的详情收集逻辑');
}
