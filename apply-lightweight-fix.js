/**
 * 应用轻量详情保存优化
 * 50期以下保存10%，50期以上保存8%
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 查找函数的起始和结束位置
const funcStart = content.indexOf('function determinePeriodsToSaveDetails(results, config) {');
if (funcStart === -1) {
    console.log('找不到函数定义');
    process.exit(1);
}

// 找到函数结束位置（通过计算花括号）
let braceCount = 0;
let funcEnd = -1;
for (let i = funcStart; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    if (braceCount === 0 && content[i] === '}') {
        funcEnd = i + 1;
        break;
    }
}

if (funcEnd === -1) {
    console.log('找不到函数结束位置');
    process.exit(1);
}

console.log('找到函数位置:', funcStart, '-', funcEnd);
console.log('原函数长度:', funcEnd - funcStart, '字符');

// 新的函数实现
const newFunc = `function determinePeriodsToSaveDetails(results, config) {
    const fullDetailsPeriods = new Set();
    const lightweightPeriods = new Set();
    const totalPeriods = results.length;

    // ⭐ 2025-12-03 优化: 轻量详情不再保存全部，而是按比例保存最近的期号
    // 50期以下保存10%，50期以上保存8%，避免MongoDB连接超时
    const lightweightRatio = totalPeriods <= 50 ? 0.10 : 0.08;
    const maxLightweightCount = Math.max(1, Math.ceil(totalPeriods * lightweightRatio));

    // 1. 推算期始终保存完整详情
    results.filter(r => r.is_predicted).forEach(r => {
        fullDetailsPeriods.add(String(r.target_issue));
    });

    // 2. 如果配置为"不保存"或未启用，只保存推算期完整详情，不保存轻量详情
    if (!config || !config.enabled || config.mode === 'none') {
        log(\`  📝 保存模式: none - 仅推算期\${fullDetailsPeriods.size}期保存完整详情\`);
        return { fullDetailsPeriods, lightweightPeriods };
    }

    // 3. 根据配置模式确定需要完整详情的期号
    const drawnPeriods = results.filter(r => !r.is_predicted && r.hit_analysis);

    if (config.mode === 'top_hit') {
        // 命中最多的N期（从最近的期号中选择）
        const sortedByHit = [...drawnPeriods].sort((a, b) => {
            const hitA = a.hit_analysis?.max_red_hit || 0;
            const hitB = b.hit_analysis?.max_red_hit || 0;
            return hitB - hitA;
        });
        const topN = config.top_hit_count || 10;
        for (let i = 0; i < Math.min(topN, sortedByHit.length); i++) {
            fullDetailsPeriods.add(String(sortedByHit[i].target_issue));
        }

    } else if (config.mode === 'recent') {
        // 最近N期
        const sortedByIssue = [...drawnPeriods].sort((a, b) => {
            return parseInt(b.target_issue) - parseInt(a.target_issue);
        });
        const recentN = config.recent_count || 10;
        for (let i = 0; i < Math.min(recentN, sortedByIssue.length); i++) {
            fullDetailsPeriods.add(String(sortedByIssue[i].target_issue));
        }

    } else if (config.mode === 'all') {
        // 全部保存完整详情
        results.forEach(r => {
            fullDetailsPeriods.add(String(r.target_issue));
        });
        log(\`  📝 保存模式: all - 全部\${fullDetailsPeriods.size}期保存完整详情\`);
        return { fullDetailsPeriods, lightweightPeriods };
    }

    // 4. ⭐ 2025-12-03 优化: 从非完整详情的期号中，选择最近的N期作为轻量详情
    // 按期号降序排序，取前 maxLightweightCount 个
    const nonFullDetailsPeriods = drawnPeriods
        .filter(r => !fullDetailsPeriods.has(String(r.target_issue)))
        .sort((a, b) => parseInt(b.target_issue) - parseInt(a.target_issue));

    const lightweightCount = Math.min(maxLightweightCount, nonFullDetailsPeriods.length);
    for (let i = 0; i < lightweightCount; i++) {
        lightweightPeriods.add(String(nonFullDetailsPeriods[i].target_issue));
    }

    log(\`  📝 保存模式: \${config.mode} - \${fullDetailsPeriods.size}期完整详情 + \${lightweightPeriods.size}期轻量详情 (总\${totalPeriods}期×\${(lightweightRatio*100).toFixed(0)}%≈\${maxLightweightCount}期)\`);

    return { fullDetailsPeriods, lightweightPeriods };
}`;

// 替换函数
const before = content.substring(0, funcStart);
const after = content.substring(funcEnd);
content = before + newFunc + after;

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ 函数修改成功');
console.log('新函数长度:', newFunc.length, '字符');
