/**
 * 修复脚本：为 Exclude 1-4 添加排除详情收集
 *
 * 问题：历史和值/跨度/热温冷比/区间比排除只执行了过滤，没有收集排除详情
 * 解决：为这4个排除条件添加详情收集逻辑，参考相克对排除的实现
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

// ===== 修复 1: Exclude 1 历史和值排除 =====
const oldExclude1 = `        // ============ Exclude 1: 历史和值排除 ============
        if (exclusionConditions.sum?.historical?.enabled && this.historicalStatsCache.sums) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(c => !this.historicalStatsCache.sums.has(c.sum_value));
            excludeStats.historicalSum = beforeCount - filtered.length;
            log(\`  ✅ Exclude1 历史和值排除: \${excludeStats.historicalSum}个组合 (\${beforeCount}→\${filtered.length})\`);
        }`;

const newExclude1 = `        // ============ Exclude 1: 历史和值排除 ============
        // ⭐ 2025-12-09修复: 添加排除详情收集
        if (exclusionConditions.sum?.historical?.enabled && this.historicalStatsCache.sums) {
            const beforeCount = filtered.length;
            const detailsMap_sum = collectDetails ? {} : null;
            const excludedIds_sum = [];

            filtered = filtered.filter(c => {
                if (this.historicalStatsCache.sums.has(c.sum_value)) {
                    excludedIds_sum.push(c.combination_id);
                    if (collectDetails) {
                        detailsMap_sum[c.combination_id] = {
                            sum_value: c.sum_value,
                            description: \`和值 \${c.sum_value} 在历史期号中出现过\`
                        };
                    }
                    return false;
                }
                return true;
            });

            excludeStats.historicalSum = beforeCount - filtered.length;
            log(\`  ✅ Exclude1 历史和值排除: \${excludeStats.historicalSum}个组合 (\${beforeCount}→\${filtered.length})\`);

            exclusionsToSave.push({
                step: 2,
                condition: 'exclude_step2_historical_sum',
                excludedIds: excludedIds_sum,
                detailsMap: detailsMap_sum,
                metadata: {
                    historical_sum: {
                        excluded_sums: Array.from(this.historicalStatsCache.sums),
                        total_count: this.historicalStatsCache.sums.size
                    }
                }
            });
        }`;

if (content.includes(oldExclude1)) {
    content = content.replace(oldExclude1, newExclude1);
    console.log('✅ 修复1: Exclude 1 历史和值排除 - 已添加详情收集');
    modified = true;
} else if (content.includes('⭐ 2025-12-09修复: 添加排除详情收集') && content.includes('exclude_step2_historical_sum')) {
    console.log('✅ 修复1: Exclude 1 历史和值排除 - 已经修复过');
} else {
    console.log('❌ 修复1: 未找到目标代码块');
}

// ===== 修复 2: Exclude 2 历史跨度排除 =====
const oldExclude2 = `        // ============ Exclude 2: 历史跨度排除 ============
        if (exclusionConditions.span?.historical?.enabled && this.historicalStatsCache.spans) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(c => !this.historicalStatsCache.spans.has(c.span_value));
            excludeStats.historicalSpan = beforeCount - filtered.length;
            log(\`  ✅ Exclude2 历史跨度排除: \${excludeStats.historicalSpan}个组合 (\${beforeCount}→\${filtered.length})\`);
        }`;

const newExclude2 = `        // ============ Exclude 2: 历史跨度排除 ============
        // ⭐ 2025-12-09修复: 添加排除详情收集
        if (exclusionConditions.span?.historical?.enabled && this.historicalStatsCache.spans) {
            const beforeCount = filtered.length;
            const detailsMap_span = collectDetails ? {} : null;
            const excludedIds_span = [];

            filtered = filtered.filter(c => {
                if (this.historicalStatsCache.spans.has(c.span_value)) {
                    excludedIds_span.push(c.combination_id);
                    if (collectDetails) {
                        detailsMap_span[c.combination_id] = {
                            span_value: c.span_value,
                            description: \`跨度 \${c.span_value} 在历史期号中出现过\`
                        };
                    }
                    return false;
                }
                return true;
            });

            excludeStats.historicalSpan = beforeCount - filtered.length;
            log(\`  ✅ Exclude2 历史跨度排除: \${excludeStats.historicalSpan}个组合 (\${beforeCount}→\${filtered.length})\`);

            exclusionsToSave.push({
                step: 3,
                condition: 'exclude_step3_historical_span',
                excludedIds: excludedIds_span,
                detailsMap: detailsMap_span,
                metadata: {
                    historical_span: {
                        excluded_spans: Array.from(this.historicalStatsCache.spans),
                        total_count: this.historicalStatsCache.spans.size
                    }
                }
            });
        }`;

if (content.includes(oldExclude2)) {
    content = content.replace(oldExclude2, newExclude2);
    console.log('✅ 修复2: Exclude 2 历史跨度排除 - 已添加详情收集');
    modified = true;
} else if (content.includes('exclude_step3_historical_span')) {
    console.log('✅ 修复2: Exclude 2 历史跨度排除 - 已经修复过');
} else {
    console.log('❌ 修复2: 未找到目标代码块');
}

// ===== 修复 3: Exclude 3 历史热温冷比排除 =====
const oldExclude3 = `                if (hwcMap) {
                    const comboToHwcMap = new Map();
                    for (const [ratio, ids] of hwcMap) {
                        for (const id of ids) {
                            comboToHwcMap.set(id, ratio);
                        }
                    }

                    const beforeCount = filtered.length;
                    filtered = filtered.filter(c => {
                        const hwcRatio = comboToHwcMap.get(c.combination_id);
                        return !historicalHwcRatios.has(hwcRatio);
                    });
                    excludeStats.historicalHwc = beforeCount - filtered.length;
                    log(\`  ✅ Exclude3 历史热温冷比排除: \${excludeStats.historicalHwc}个组合 (\${beforeCount}→\${filtered.length})\`);
                }`;

const newExclude3 = `                if (hwcMap) {
                    const comboToHwcMap = new Map();
                    for (const [ratio, ids] of hwcMap) {
                        for (const id of ids) {
                            comboToHwcMap.set(id, ratio);
                        }
                    }

                    // ⭐ 2025-12-09修复: 添加排除详情收集
                    const beforeCount = filtered.length;
                    const detailsMap_hwc = collectDetails ? {} : null;
                    const excludedIds_hwc = [];

                    filtered = filtered.filter(c => {
                        const hwcRatio = comboToHwcMap.get(c.combination_id);
                        if (historicalHwcRatios.has(hwcRatio)) {
                            excludedIds_hwc.push(c.combination_id);
                            if (collectDetails) {
                                detailsMap_hwc[c.combination_id] = {
                                    hwc_ratio: hwcRatio,
                                    description: \`热温冷比 \${hwcRatio} 在历史期号中出现过\`
                                };
                            }
                            return false;
                        }
                        return true;
                    });

                    excludeStats.historicalHwc = beforeCount - filtered.length;
                    log(\`  ✅ Exclude3 历史热温冷比排除: \${excludeStats.historicalHwc}个组合 (\${beforeCount}→\${filtered.length})\`);

                    exclusionsToSave.push({
                        step: 4,
                        condition: 'exclude_step4_historical_hwc',
                        excludedIds: excludedIds_hwc,
                        detailsMap: detailsMap_hwc,
                        metadata: {
                            historical_hwc: {
                                excluded_ratios: Array.from(historicalHwcRatios),
                                period: period,
                                total_count: historicalHwcRatios.size
                            }
                        }
                    });
                }`;

if (content.includes(oldExclude3)) {
    content = content.replace(oldExclude3, newExclude3);
    console.log('✅ 修复3: Exclude 3 历史热温冷比排除 - 已添加详情收集');
    modified = true;
} else if (content.includes('exclude_step4_historical_hwc')) {
    console.log('✅ 修复3: Exclude 3 历史热温冷比排除 - 已经修复过');
} else {
    console.log('❌ 修复3: 未找到目标代码块');
}

// ===== 修复 4: Exclude 4 历史区间比排除 =====
const oldExclude4 = `        // ============ Exclude 4: 历史区间比排除 ============
        if (exclusionConditions.zone?.historical?.enabled && this.historicalStatsCache.zoneRatios) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(c => !this.historicalStatsCache.zoneRatios.has(c.zone_ratio));
            excludeStats.historicalZone = beforeCount - filtered.length;
            log(\`  ✅ Exclude4 历史区间比排除: \${excludeStats.historicalZone}个组合 (\${beforeCount}→\${filtered.length})\`);
        }`;

const newExclude4 = `        // ============ Exclude 4: 历史区间比排除 ============
        // ⭐ 2025-12-09修复: 添加排除详情收集
        if (exclusionConditions.zone?.historical?.enabled && this.historicalStatsCache.zoneRatios) {
            const beforeCount = filtered.length;
            const detailsMap_zone = collectDetails ? {} : null;
            const excludedIds_zone = [];

            filtered = filtered.filter(c => {
                if (this.historicalStatsCache.zoneRatios.has(c.zone_ratio)) {
                    excludedIds_zone.push(c.combination_id);
                    if (collectDetails) {
                        detailsMap_zone[c.combination_id] = {
                            zone_ratio: c.zone_ratio,
                            description: \`区间比 \${c.zone_ratio} 在历史期号中出现过\`
                        };
                    }
                    return false;
                }
                return true;
            });

            excludeStats.historicalZone = beforeCount - filtered.length;
            log(\`  ✅ Exclude4 历史区间比排除: \${excludeStats.historicalZone}个组合 (\${beforeCount}→\${filtered.length})\`);

            exclusionsToSave.push({
                step: 6,
                condition: 'exclude_step6_historical_zone',
                excludedIds: excludedIds_zone,
                detailsMap: detailsMap_zone,
                metadata: {
                    historical_zone: {
                        excluded_ratios: Array.from(this.historicalStatsCache.zoneRatios),
                        total_count: this.historicalStatsCache.zoneRatios.size
                    }
                }
            });
        }`;

if (content.includes(oldExclude4)) {
    content = content.replace(oldExclude4, newExclude4);
    console.log('✅ 修复4: Exclude 4 历史区间比排除 - 已添加详情收集');
    modified = true;
} else if (content.includes('exclude_step6_historical_zone')) {
    console.log('✅ 修复4: Exclude 4 历史区间比排除 - 已经修复过');
} else {
    console.log('❌ 修复4: 未找到目标代码块');
}

// 写回文件
if (modified) {
    // 恢复原始换行符
    if (originalLineEnding === '\r\n') {
        content = content.replace(/\n/g, '\r\n');
    }

    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('\n========================================');
    console.log('✅ 所有修复已应用！');
    console.log('修改位置: applyExclusionConditions() 方法');
    console.log('========================================');
} else {
    console.log('\n========================================');
    console.log('ℹ️ 无需修改（可能已经修复过）');
    console.log('========================================');
}
