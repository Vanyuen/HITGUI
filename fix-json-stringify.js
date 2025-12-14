const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

let content = fs.readFileSync(path, 'utf8');

const oldCode = `            const totalMB = (
                (JSON.stringify(redCombos).length +
                 JSON.stringify(blueCombos).length +
                 JSON.stringify(historyData).length +
                 JSON.stringify(comboFeatures).length +
                 JSON.stringify(missingData).length) / 1024 / 1024
            ).toFixed(2);

            log(\`✅ [GlobalCache] 缓存构建完成: 耗时\${buildTime}ms, 占用约\${totalMB}MB\`);`;

const newCode = `            // ⭐ 2025-12-02修复: 使用轻量估算替代 JSON.stringify
            // 原代码会创建 200-600MB 临时字符串导致内存溢出
            const estimateArraySize = (arr, bytesPerItem = 200) => {
                return (arr?.length || 0) * bytesPerItem;
            };

            const totalMB = (
                (estimateArraySize(redCombos, 200) +
                 estimateArraySize(blueCombos, 50) +
                 estimateArraySize(historyData, 100) +
                 estimateArraySize(comboFeatures, 5000) +
                 estimateArraySize(missingData, 100)) / 1024 / 1024
            ).toFixed(2);

            log(\`✅ [GlobalCache] 缓存构建完成: 耗时\${buildTime}ms, 占用约\${totalMB}MB (估算)\`);`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('✅ 修复完成: JSON.stringify 已替换为轻量估算');
} else {
    console.log('❌ 未找到目标代码块');

    // 尝试查找关键特征
    const idx = content.indexOf('JSON.stringify(redCombos)');
    if (idx !== -1) {
        console.log('找到 JSON.stringify(redCombos) 位置:', idx);
        console.log('周围内容:\n', content.substring(idx - 100, idx + 400));
    } else {
        console.log('未找到 JSON.stringify(redCombos)');
    }
}
