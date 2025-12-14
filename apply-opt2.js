const fs = require('fs');
const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldStr = `                // 🐛 2025-11-29: 提前判断是否是推算期，用于决定是否收集详情
                const targetData = await hit_dlts.findOne({ Issue: parseInt(targetIssue) }).lean();
                const isPredicted = !targetData;  // 未找到记录 = 推算期`;

const newStr = `                // 🐛 2025-11-29: 提前判断是否是推算期，用于决定是否收集详情
                // ⚡ 2025-12-07优化: 使用cachedHistoryDataMap缓存，避免每期单独查询数据库
                const targetData = this.cachedHistoryDataMap?.get(targetIssue.toString()) || null;
                const isPredicted = !targetData;  // 未找到记录 = 推算期`;

if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 优化点2: processBatch使用缓存判断推算期 - 完成');
} else {
    console.log('❌ 未找到目标代码');
}
