/**
 * 更新前端 admin.js 显示友好名称
 */
const fs = require('fs');

const filePath = 'src/renderer/admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 替换显示名称逻辑
const oldCode = '<h4>${table.name}</h4>';
const newCode = '<h4>${table.displayName || table.name}</h4>';

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 前端 admin.js 已更新 - 使用 displayName 显示友好名称');
} else if (content.includes(newCode)) {
    console.log('✅ 前端 admin.js 已经是最新版本');
} else {
    console.log('❌ 未找到目标代码');
}
