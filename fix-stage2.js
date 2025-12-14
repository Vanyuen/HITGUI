const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

let content = fs.readFileSync(path, 'utf8');

// 使用正则表达式匹配Stage 2代码块
const oldPattern = /            \/\/ ⭐ Stage 2: top_hit 模式下为命中最多期号补充 detailsMap[\s\S]*?if \(exclusionDetailsConfig\.mode === 'top_hit'\) \{[\s\S]*?const cachedRedCombinations = globalCacheManager\.getCachedData\(\)\.redCombinations;[\s\S]*?if \(cachedRedCombinations && cachedRedCombinations\.length > 0\) \{[\s\S]*?regenerateDetailsMapForTopHitPeriods[\s\S]*?\} else \{[\s\S]*?log\(`⚠️ \[\$\{taskId\}\] Stage 2 跳过: 全局缓存中无红球组合数据`\);[\s\S]*?\}[\s\S]*?\}/;

const newCode = `            // ⭐ 2025-12-02: 方案B - 按需生成（替代Stage 2）
            // 原Stage 2在此处为top_hit期号生成detailsMap，导致内存溢出(~800MB+)
            // 方案B: detailsMap改为Excel导出时按需生成，这里只保存excludedIds+metadata
            // 优势: 任务期间内存从~800MB降至~80MB
            if (exclusionDetailsConfig.mode === 'top_hit') {
                log(\`📝 [\${taskId}] 方案B: top_hit模式 - detailsMap将在导出时按需生成（节省内存~800MB）\`);
            }`;

if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newCode);
    fs.writeFileSync(path, content, 'utf8');
    console.log('✅ 修改点1完成: Stage 2代码已替换为方案B');
} else {
    console.log('❌ 未找到目标代码块');

    // 尝试简单匹配
    const simplePattern = /if \(exclusionDetailsConfig\.mode === 'top_hit'\) \{\s*const cachedRedCombinations = globalCacheManager\.getCachedData\(\)\.redCombinations;[\s\S]*?Stage 2 跳过[\s\S]*?\}\s*\}/;

    const match = content.match(simplePattern);
    if (match) {
        console.log('找到简单匹配:', match[0].substring(0, 200));
    }
}
