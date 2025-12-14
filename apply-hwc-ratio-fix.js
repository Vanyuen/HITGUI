/**
 * 热温冷比格式转换修复脚本 v2
 * 2025-12-12
 *
 * 问题: 前端传入对象格式 {hot:3, warm:1, cold:1}，但热温冷优化表键是字符串格式 "3:1:1"
 * 修复: 在查询前将对象格式转换为字符串格式
 */

const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

// 读取文件
let content = fs.readFileSync(path, 'utf8');

// 检查是否已经修复
if (content.includes('2025-12-12修复: 将对象格式')) {
    console.log('⚠️ 修复已存在，无需再次应用');
    process.exit(0);
}

// 定义旧代码（使用CRLF换行）
const oldCode = `                // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致\r
                (positive_selection.red_hot_warm_cold_ratios || []).forEach(ratio => {\r
                    const ids = hwcData[ratio] || [];\r
                    ids.forEach(id => candidateIds.add(id));\r
                });`;

// 定义新代码（使用CRLF换行）
const newCode = `                // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致\r
                // ⭐ 2025-12-12修复: 将对象格式 {hot:3, warm:1, cold:1} 转换为字符串格式 "3:1:1"\r
                (positive_selection.red_hot_warm_cold_ratios || []).forEach(ratio => {\r
                    const ratioKey = (typeof ratio === 'object' && ratio !== null)\r
                        ? \`\${ratio.hot}:\${ratio.warm}:\${ratio.cold}\`\r
                        : ratio;\r
                    const ids = hwcData[ratioKey] || [];\r
                    ids.forEach(id => candidateIds.add(id));\r
                });`;

// 检查是否找到目标代码
if (!content.includes(oldCode)) {
    console.log('❌ 未找到目标代码（可能行尾格式不同）');

    // 尝试使用更宽松的匹配
    const searchPattern = 'const ids = hwcData[ratio] || [];';
    if (content.includes(searchPattern)) {
        console.log('✅ 找到关键代码行，尝试直接替换...');

        // 直接替换关键行
        const oldLine = '                    const ids = hwcData[ratio] || [];';
        const newLines = `                    const ratioKey = (typeof ratio === 'object' && ratio !== null)\r
                        ? \`\${ratio.hot}:\${ratio.warm}:\${ratio.cold}\`\r
                        : ratio;\r
                    const ids = hwcData[ratioKey] || [];`;

        // 同时在 forEach 前添加注释
        const oldComment = '                // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致';
        const newComment = `                // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致\r
                // ⭐ 2025-12-12修复: 将对象格式 {hot:3, warm:1, cold:1} 转换为字符串格式 "3:1:1"`;

        content = content.replace(oldLine, newLines);
        content = content.replace(oldComment, newComment);

        fs.writeFileSync(path, content, 'utf8');
        console.log('✅ 修复已应用（使用宽松匹配）');
    } else {
        console.log('❌ 完全找不到目标代码');
        process.exit(1);
    }
} else {
    // 应用修复
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('✅ 修复已成功应用!');
}

// 验证修复
const verifyContent = fs.readFileSync(path, 'utf8');
if (verifyContent.includes('2025-12-12修复: 将对象格式')) {
    console.log('✅ 验证通过: 修复代码已写入文件');

    // 语法检查
    const { execSync } = require('child_process');
    try {
        execSync('node --check E:/HITGUI/src/server/server.js', { encoding: 'utf8' });
        console.log('✅ 语法检查通过');
    } catch (e) {
        console.log('❌ 语法检查失败:', e.message);
    }
} else {
    console.log('❌ 验证失败: 修复代码未能正确写入');
}
