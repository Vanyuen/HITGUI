/**
 * 修复 server.js 语法错误
 * 问题：第28658行注释把 { 放在了注释里
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 错误的代码
const wrongCode = '} else if (parseInt(allIssues[allIssues.length - 1].Issue) > latestProcessedIssue)  // 修复: 数字比较 {';

// 正确的代码
const fixedCode = '} else if (parseInt(allIssues[allIssues.length - 1].Issue) > latestProcessedIssue) {  // 修复: 数字比较';

if (content.includes(wrongCode)) {
    content = content.replace(wrongCode, fixedCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('语法错误已修复');
} else if (content.includes(fixedCode)) {
    console.log('语法已经是正确的');
} else {
    console.log('未找到需要修复的代码');
}
