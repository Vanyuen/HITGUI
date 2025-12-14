/**
 * 修复脚本：calculateHistoricalStatsForIssue 字段名兼容性修复
 *
 * 问题：前端发送 sum.historical.enabled + count
 *       后端期望 historicalSum.enabled + period
 *
 * 解决：修改 calculateHistoricalStatsForIssue 方法，兼容两种字段结构
 *
 * 2025-12-09
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 规范化换行符
const originalLineEnding = content.includes('\r\n') ? '\r\n' : '\n';
content = content.replace(/\r\n/g, '\n');

let modified = false;

// ===== 修复 calculateHistoricalStatsForIssue 方法 =====

// 旧代码块1: maxPeriod 计算部分
const oldMaxPeriod = `    async calculateHistoricalStatsForIssue(baseID, exclusionConditions) {
        try {
            // 确定需要的最大历史期数
            let maxPeriod = 0;
            if (exclusionConditions.historicalSum?.enabled) {
                maxPeriod = Math.max(maxPeriod, exclusionConditions.historicalSum.period || 10);
            }
            if (exclusionConditions.historicalSpan?.enabled) {
                maxPeriod = Math.max(maxPeriod, exclusionConditions.historicalSpan.period || 10);
            }
            if (exclusionConditions.historicalHwc?.enabled) {
                maxPeriod = Math.max(maxPeriod, exclusionConditions.historicalHwc.period || 10);
            }
            if (exclusionConditions.historicalZone?.enabled) {
                maxPeriod = Math.max(maxPeriod, exclusionConditions.historicalZone.period || 10);
            }`;

const newMaxPeriod = `    async calculateHistoricalStatsForIssue(baseID, exclusionConditions) {
        try {
            // ⭐ 2025-12-09修复: 兼容前端新结构 (sum.historical) 和旧结构 (historicalSum)
            // 前端发送: { sum: { historical: { enabled, count } } }
            // 旧格式:   { historicalSum: { enabled, period } }
            const sumHistorical = exclusionConditions.sum?.historical || exclusionConditions.historicalSum;
            const spanHistorical = exclusionConditions.span?.historical || exclusionConditions.historicalSpan;
            const hwcHistorical = exclusionConditions.hwc?.historical || exclusionConditions.historicalHwc;
            const zoneHistorical = exclusionConditions.zone?.historical || exclusionConditions.historicalZone;

            // 确定需要的最大历史期数
            let maxPeriod = 0;
            if (sumHistorical?.enabled) {
                maxPeriod = Math.max(maxPeriod, sumHistorical.count || sumHistorical.period || 10);
            }
            if (spanHistorical?.enabled) {
                maxPeriod = Math.max(maxPeriod, spanHistorical.count || spanHistorical.period || 10);
            }
            if (hwcHistorical?.enabled) {
                maxPeriod = Math.max(maxPeriod, hwcHistorical.count || hwcHistorical.period || 10);
            }
            if (zoneHistorical?.enabled) {
                maxPeriod = Math.max(maxPeriod, zoneHistorical.count || zoneHistorical.period || 10);
            }`;

if (content.includes(oldMaxPeriod)) {
    content = content.replace(oldMaxPeriod, newMaxPeriod);
    console.log('✅ 修复1: maxPeriod计算部分 - 已添加字段兼容');
    modified = true;
} else if (content.includes('⭐ 2025-12-09修复: 兼容前端新结构')) {
    console.log('✅ 修复1: maxPeriod计算部分 - 已经修复过');
} else {
    console.log('❌ 修复1: 未找到目标代码块 (maxPeriod)');
}

// 旧代码块2: 历史和值统计
const oldSumStats = `            // 1. 计算历史和值
            if (exclusionConditions.historicalSum?.enabled) {
                const period = exclusionConditions.historicalSum.period || 10;
                this.historicalStatsCache.sums = new Set(
                    historicalRecords.slice(0, period).map(h =>
                        h.Red1 + h.Red2 + h.Red3 + h.Red4 + h.Red5
                    )
                );
                log(\`    ✅ 历史和值统计: \${this.historicalStatsCache.sums.size}个不重复和值 (\${period}期)\`);
            }`;

const newSumStats = `            // 1. 计算历史和值
            // ⭐ 2025-12-09修复: 使用兼容变量
            if (sumHistorical?.enabled) {
                const period = sumHistorical.count || sumHistorical.period || 10;
                this.historicalStatsCache.sums = new Set(
                    historicalRecords.slice(0, period).map(h =>
                        h.Red1 + h.Red2 + h.Red3 + h.Red4 + h.Red5
                    )
                );
                log(\`    ✅ 历史和值统计: \${this.historicalStatsCache.sums.size}个不重复和值 (\${period}期)\`);
            }`;

if (content.includes(oldSumStats)) {
    content = content.replace(oldSumStats, newSumStats);
    console.log('✅ 修复2: 历史和值统计 - 已添加字段兼容');
    modified = true;
} else if (content.includes('// ⭐ 2025-12-09修复: 使用兼容变量') && content.includes('sumHistorical?.enabled')) {
    console.log('✅ 修复2: 历史和值统计 - 已经修复过');
} else {
    console.log('❌ 修复2: 未找到目标代码块 (历史和值统计)');
}

// 旧代码块3: 历史跨度统计
const oldSpanStats = `            // 2. 计算历史跨度
            if (exclusionConditions.historicalSpan?.enabled) {
                const period = exclusionConditions.historicalSpan.period || 10;
                this.historicalStatsCache.spans = new Set(
                    historicalRecords.slice(0, period).map(h => {
                        const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                        return Math.max(...reds) - Math.min(...reds);
                    })
                );
                log(\`    ✅ 历史跨度统计: \${this.historicalStatsCache.spans.size}个不重复跨度 (\${period}期)\`);
            }`;

const newSpanStats = `            // 2. 计算历史跨度
            // ⭐ 2025-12-09修复: 使用兼容变量
            if (spanHistorical?.enabled) {
                const period = spanHistorical.count || spanHistorical.period || 10;
                this.historicalStatsCache.spans = new Set(
                    historicalRecords.slice(0, period).map(h => {
                        const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                        return Math.max(...reds) - Math.min(...reds);
                    })
                );
                log(\`    ✅ 历史跨度统计: \${this.historicalStatsCache.spans.size}个不重复跨度 (\${period}期)\`);
            }`;

if (content.includes(oldSpanStats)) {
    content = content.replace(oldSpanStats, newSpanStats);
    console.log('✅ 修复3: 历史跨度统计 - 已添加字段兼容');
    modified = true;
} else if (content.includes('spanHistorical?.enabled')) {
    console.log('✅ 修复3: 历史跨度统计 - 已经修复过');
} else {
    console.log('❌ 修复3: 未找到目标代码块 (历史跨度统计)');
}

// 旧代码块4: 历史区间比统计
const oldZoneStats = `            // 3. 计算历史区间比
            if (exclusionConditions.historicalZone?.enabled) {
                const period = exclusionConditions.historicalZone.period || 10;
                this.historicalStatsCache.zoneRatios = new Set(
                    historicalRecords.slice(0, period).map(h => {
                        const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                        const zone1 = reds.filter(r => r >= 1 && r <= 12).length;
                        const zone2 = reds.filter(r => r >= 13 && r <= 24).length;
                        const zone3 = reds.filter(r => r >= 25 && r <= 35).length;
                        return \`\${zone1}:\${zone2}:\${zone3}\`;
                    })
                );
                log(\`    ✅ 历史区间比统计: \${this.historicalStatsCache.zoneRatios.size}个不重复区间比 (\${period}期)\`);
            }`;

const newZoneStats = `            // 3. 计算历史区间比
            // ⭐ 2025-12-09修复: 使用兼容变量
            if (zoneHistorical?.enabled) {
                const period = zoneHistorical.count || zoneHistorical.period || 10;
                this.historicalStatsCache.zoneRatios = new Set(
                    historicalRecords.slice(0, period).map(h => {
                        const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                        const zone1 = reds.filter(r => r >= 1 && r <= 12).length;
                        const zone2 = reds.filter(r => r >= 13 && r <= 24).length;
                        const zone3 = reds.filter(r => r >= 25 && r <= 35).length;
                        return \`\${zone1}:\${zone2}:\${zone3}\`;
                    })
                );
                log(\`    ✅ 历史区间比统计: \${this.historicalStatsCache.zoneRatios.size}个不重复区间比 (\${period}期)\`);
            }`;

if (content.includes(oldZoneStats)) {
    content = content.replace(oldZoneStats, newZoneStats);
    console.log('✅ 修复4: 历史区间比统计 - 已添加字段兼容');
    modified = true;
} else if (content.includes('zoneHistorical?.enabled')) {
    console.log('✅ 修复4: 历史区间比统计 - 已经修复过');
} else {
    console.log('❌ 修复4: 未找到目标代码块 (历史区间比统计)');
}

// 写回文件
if (modified) {
    // 恢复原始换行符
    if (originalLineEnding === '\r\n') {
        content = content.replace(/\n/g, '\r\n');
    }

    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('\n========================================');
    console.log('✅ 字段兼容性修复已应用！');
    console.log('修改位置: calculateHistoricalStatsForIssue() 方法');
    console.log('========================================');
} else {
    console.log('\n========================================');
    console.log('ℹ️ 无需修改（可能已经修复过）');
    console.log('========================================');
}
