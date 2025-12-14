// 修复变量名拼写错误：historicalIssues -> historicalDrawings

const fs = require('fs');

const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const searchPattern = 'historicalIssues.length';
const replacement = 'historicalDrawings.length';

if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 修复已应用: historicalIssues -> historicalDrawings');
} else {
    console.log('❌ 未找到目标代码，可能已修复');
}
