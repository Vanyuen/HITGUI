const fs = require('fs');
const content = fs.readFileSync('src/server/server.js', 'utf8');

const oldText = `        // ============ Step 1: 热温冷比筛选 ============
        const hwcKey = \`\${baseIssue}-\${targetIssue}\`;
        const hwcMap = this.hwcOptimizedCache?.get(hwcKey);
        // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致
        const selectedHwcRatios = positiveSelection.red_hot_warm_cold_ratios || [];`;

const newText = `        // ============ Step 1: 热温冷比筛选 ============
        const hwcKey = \`\${baseIssue}-\${targetIssue}\`;
        const hwcMap = this.hwcOptimizedCache?.get(hwcKey);

        // 🔍 DEBUG 2025-12-13: 详细日志帮助定位25141/25142返回0的问题
        log(\`  🔍 [DEBUG] hwcKey=\${hwcKey}, hwcMap存在=\${!!hwcMap}, hwcOptimizedCache大小=\${this.hwcOptimizedCache?.size || 0}\`);
        if (!hwcMap && this.hwcOptimizedCache?.size > 0) {
            const allKeys = Array.from(this.hwcOptimizedCache.keys());
            log(\`  🔍 [DEBUG] 缓存中的keys (共\${allKeys.length}个): 前5个=[\${allKeys.slice(0, 5).join(', ')}], 后5个=[\${allKeys.slice(-5).join(', ')}]\`);
        }

        // ⭐ 2025-11-14修复点4: 字段名与前端/API验证保持一致
        const selectedHwcRatios = positiveSelection.red_hot_warm_cold_ratios || [];`;

if (content.includes(oldText)) {
    const newContent = content.replace(oldText, newText);
    fs.writeFileSync('src/server/server.js', newContent);
    console.log('Success: Debug logging added');
} else {
    console.log('Pattern not found');
}
