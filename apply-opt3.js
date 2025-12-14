const fs = require('fs');
const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldStr = `            // ⚡ 性能优化：优先从缓存获取实际开奖结果
            let actualResult;
            if (this.cachedHistoryData && this.cachedHistoryData.size > 0) {
                actualResult = this.cachedHistoryData.get(issue.toString());
                if (actualResult) {
                    log(\`⚡ [\${this.sessionId}] 从缓存获取期号\${issue}开奖数据\`);
                }
            }

            // 缓存未命中，回退到数据库查询
            if (!actualResult) {
                log(\`⚠️ [\${this.sessionId}] 缓存未命中，从数据库查询期号\${issue}开奖数据...\`);
                actualResult = await hit_dlts.findOne({ Issue: parseInt(issue) }).lean();
            }`;

const newStr = `            // ⚡ 性能优化：优先从缓存获取实际开奖结果
            // ⚡ 2025-12-07优化: 使用cachedHistoryDataMap（修复原cachedHistoryData是数组没有.size/.get方法的BUG）
            let actualResult;
            if (this.cachedHistoryDataMap && this.cachedHistoryDataMap.size > 0) {
                actualResult = this.cachedHistoryDataMap.get(issue.toString());
                if (actualResult) {
                    log(\`⚡ [\${this.sessionId}] 从缓存获取期号\${issue}开奖数据\`);
                }
            }

            // 缓存未命中，回退到数据库查询
            if (!actualResult) {
                log(\`⚠️ [\${this.sessionId}] 缓存未命中，从数据库查询期号\${issue}开奖数据...\`);
                actualResult = await hit_dlts.findOne({ Issue: parseInt(issue) }).lean();
            }`;

if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 优化点3: performHitValidation使用新Map缓存 - 完成');
} else {
    console.log('❌ 未找到目标代码');
}
