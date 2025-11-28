# 排除条件"最近N期"历史统计 - ID-1规则修复方案

## 诊断时间
2025-11-14

## 问题描述

### 核心问题
排除条件中的"最近N期"历史统计（和值、跨度、区间比、相克对）当前使用**数组切片方式**，但这种方式在逻辑上存在问题。

### 问题场景

**用户选择**：
- 预测期号范围：25118-25124 (7个期号)
- 历史和值统计：最近3期

**当前错误逻辑**：
```javascript
// Line 12450-12451: cachedHistoryData按Issue降序排列
this.cachedHistoryData = Array.from(cachedData.historyData.values())
    .sort((a, b) => b.Issue - a.Issue);

// Line 15107: 直接使用slice(0, maxPeriod)
const recentData = this.cachedHistoryData.slice(0, maxPeriod);
```

**问题分析**：
```
数据库记录（按Issue降序）:
[0] ID 2788: 期号 25120
[1] ID 2787: 期号 25119
[2] ID 2786: 期号 25118 ← 第一个预测目标期号
[3] ID 2785: 期号 25117
[4] ID 2784: 期号 25116
[5] ID 2783: 期号 25115

预测25118时，"最近3期"应该是什么？
❌ 错误理解：从数组[0]开始取3个 → [25120, 25119, 25118]
   - 包含了25118本身（未开奖）
   - 包含了25119和25120（比25118还晚）

✅ 正确理解：从25118的**上一期（ID-1）往前取3期**
   - 25118的ID=2786，上一期ID=2785 (期号25117)
   - 从25117开始往前取3期 → [25117, 25116, 25115]
   - 不包含25118及之后的期号
```

### BUG根本原因

**当前逻辑的问题**：
1. `cachedHistoryData`是**全局所有历史数据**（降序排列）
2. 每个预测期号都使用**同一份历史数据**进行统计
3. 没有根据**当前预测期号**动态调整历史数据的起点

**正确逻辑应该是**：
- 预测期号25118 → 历史统计从ID 2785开始
- 预测期号25119 → 历史统计从ID 2786开始
- 预测期号25120 → 历史统计从ID 2787开始
- ... 每个期号都有自己对应的历史数据起点

## 修复方案

### 方案概述
为每个预测期号建立**ID-1基准点**，历史统计从该基准点开始往前查找N期。

### 修复点1：构建期号→ID映射 (在preloadData中)

**位置**：`src/server/server.js:16084` (HwcPositivePredictor.preloadData方法)

**添加ID映射缓存**：
```javascript
async preloadData(targetIssues, filters, exclude_conditions, maxRedCombinations, enableValidation) {
    // 1. 调用父类的预加载方法
    await super.preloadData(targetIssues, filters, exclude_conditions, maxRedCombinations, enableValidation);

    // 2. 🔧 修复：基于ID生成准确的期号对
    log(`📥 [${this.sessionId}] 基于ID生成期号对...`);

    const issuePairs = [];
    const issueNumbers = targetIssues.map(i => parseInt(i.toString ? i.toString() : String(i)));

    // ... 现有期号对生成逻辑 ...

    // ⭐ 2025-11-14新增: 构建期号→ID映射（用于历史统计）
    this.issueToIdMap = new Map();
    for (const record of allRecords) {
        this.issueToIdMap.set(record.Issue.toString(), record.ID);
    }
    log(`  ✅ 期号→ID映射已构建: ${this.issueToIdMap.size}个期号`);

    // ... 继续预加载热温冷优化表 ...
}
```

### 修复点2：修改历史统计预加载逻辑 (preloadHistoricalStats)

**位置**：`src/server/server.js:15075` (preloadHistoricalStats方法)

**问题**：该方法当前不知道**为哪个期号**进行统计，所以无法确定ID-1基准点。

**解决方案**：将历史统计改为**按期号动态计算**，而不是全局预加载。

### 修复点3：修改applyExclusionConditions方法

**位置**：`src/server/server.js:15493` (applyExclusionConditions方法)

**当前签名**：
```javascript
async applyExclusionConditions(combinations, exclusionConditions, baseIssue, targetIssue)
```

**修改逻辑**：在方法内部动态计算当前期号的历史统计

**实现代码**：
```javascript
async applyExclusionConditions(combinations, exclusionConditions, baseIssue, targetIssue) {
    log(`🚫 [${this.sessionId}] 开始5步排除: ${baseIssue}→${targetIssue}, 初始组合=${combinations.length}个`);

    // ⭐ 2025-11-14修复: 基于target_issue的ID-1规则计算历史统计起点
    const targetIssueID = this.issueToIdMap.get(targetIssue.toString());
    if (!targetIssueID) {
        log(`⚠️ [${this.sessionId}] 无法获取期号${targetIssue}的ID，跳过历史统计`);
    } else {
        const baseID = targetIssueID - 1;  // ID-1规则
        log(`  📍 预测期号${targetIssue}(ID=${targetIssueID}), 历史统计从ID=${baseID}开始`);

        // 🔧 动态计算该期号的历史统计数据
        await this.calculateHistoricalStatsForIssue(baseID, exclusionConditions);
    }

    // ... 后续排除逻辑保持不变 ...
}
```

### 修复点4：新增calculateHistoricalStatsForIssue方法

**位置**：`src/server/server.js` (HwcPositivePredictor类中新增)

**实现代码**：
```javascript
/**
 * ⭐ 2025-11-14新增: 基于ID-1规则动态计算单个期号的历史统计
 * @param {number} baseID - 基准ID (targetID - 1)
 * @param {object} exclusionConditions - 排除条件配置
 */
async calculateHistoricalStatsForIssue(baseID, exclusionConditions) {
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
        }
        if (exclusionConditions.conflictPairs?.enabled) {
            maxPeriod = Math.max(maxPeriod, 50); // 相克对统计50期
        }

        if (maxPeriod === 0) {
            return; // 无需历史数据
        }

        // ⭐ 关键修复: 从baseID开始往前查询maxPeriod条记录
        const historicalRecords = await hit_dlts.find({
            ID: {
                $lte: baseID,  // ID <= baseID
                $gt: baseID - maxPeriod  // ID > baseID - maxPeriod
            }
        })
            .sort({ ID: -1 })  // 按ID降序
            .limit(maxPeriod)
            .lean();

        log(`  ✅ 查询历史数据: 从ID=${baseID}往前${maxPeriod}期，实际获取${historicalRecords.length}期`);

        // 1. 计算历史和值
        if (exclusionConditions.historicalSum?.enabled) {
            const period = exclusionConditions.historicalSum.period || 10;
            this.historicalStatsCache.sums = new Set(
                historicalRecords.slice(0, period).map(h =>
                    h.Red1 + h.Red2 + h.Red3 + h.Red4 + h.Red5
                )
            );
            log(`    ✅ 历史和值统计: ${this.historicalStatsCache.sums.size}个不重复和值 (${period}期)`);
        }

        // 2. 计算历史跨度
        if (exclusionConditions.historicalSpan?.enabled) {
            const period = exclusionConditions.historicalSpan.period || 10;
            this.historicalStatsCache.spans = new Set(
                historicalRecords.slice(0, period).map(h => {
                    const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                    return Math.max(...reds) - Math.min(...reds);
                })
            );
            log(`    ✅ 历史跨度统计: ${this.historicalStatsCache.spans.size}个不重复跨度 (${period}期)`);
        }

        // 3. 计算历史区间比
        if (exclusionConditions.historicalZone?.enabled) {
            const period = exclusionConditions.historicalZone.period || 10;
            this.historicalStatsCache.zoneRatios = new Set(
                historicalRecords.slice(0, period).map(h => {
                    const reds = [h.Red1, h.Red2, h.Red3, h.Red4, h.Red5];
                    const zone1 = reds.filter(r => r >= 1 && r <= 12).length;
                    const zone2 = reds.filter(r => r >= 13 && r <= 24).length;
                    const zone3 = reds.filter(r => r >= 25 && r <= 35).length;
                    return `${zone1}:${zone2}:${zone3}`;
                })
            );
            log(`    ✅ 历史区间比统计: ${this.historicalStatsCache.zoneRatios.size}个不重复区间比 (${period}期)`);
        }

        // 4. 相克对统计
        const conflictConfig = exclusionConditions.conflictPairs;
        if (conflictConfig && conflictConfig.enabled === true) {
            const hasEnabledStrategy =
                conflictConfig.globalTop?.enabled ||
                conflictConfig.perBallTop?.enabled ||
                conflictConfig.threshold?.enabled;

            if (hasEnabledStrategy) {
                let thresholdValue = 0;
                if (conflictConfig.threshold?.enabled) {
                    thresholdValue = typeof conflictConfig.threshold.value === 'number'
                        ? conflictConfig.threshold.value
                        : 0;
                }

                // 统计所有球号对的同现次数
                const pairCounts = new Map();
                for (const issue of historicalRecords.slice(0, 50)) {
                    const reds = [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5];
                    for (let i = 0; i < reds.length - 1; i++) {
                        for (let j = i + 1; j < reds.length; j++) {
                            const key = reds[i] < reds[j] ? `${reds[i]}-${reds[j]}` : `${reds[j]}-${reds[i]}`;
                            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
                        }
                    }
                }

                // 找出相克对
                this.historicalStatsCache.conflictPairs = new Set();
                for (const [pair, count] of pairCounts) {
                    if (count <= thresholdValue) {
                        this.historicalStatsCache.conflictPairs.add(pair);
                    }
                }
                log(`    ✅ 相克对统计: ${this.historicalStatsCache.conflictPairs.size}对 (阈值=${thresholdValue}, 统计50期)`);
            }
        }

    } catch (error) {
        log(`❌ [${this.sessionId}] 动态计算历史统计失败: ${error.message}`);
    }
}
```

### 修复点5：移除全局preloadHistoricalStats调用

**位置**：`src/server/server.js:17731` (processHwcPositiveTask函数)

**修改前**：
```javascript
// 预加载历史统计数据（用于排除条件）
await predictor.preloadHistoricalStats(taskData.exclusion_conditions);
```

**修改后**：
```javascript
// ⭐ 2025-11-14修复: 移除全局历史统计预加载
// 改为在applyExclusionConditions中按期号动态计算
// await predictor.preloadHistoricalStats(taskData.exclusion_conditions);  // 已废弃
```

## 修复效果

### 修复前（错误）
```
预测期号: 25118, 25119, 25120

所有期号使用相同的历史数据:
历史数据起点: 数组[0] (最新的期号)
"最近3期": [25120, 25119, 25118]  ← 包含预测期号本身
```

### 修复后（正确）
```
预测期号: 25118, 25119, 25120

每个期号使用各自的历史数据:
预测25118: 历史统计从ID 2785开始 → "最近3期": [25117, 25116, 25115] ✅
预测25119: 历史统计从ID 2786开始 → "最近3期": [25118, 25117, 25116] ✅
预测25120: 历史统计从ID 2787开始 → "最近3期": [25119, 25118, 25117] ✅
```

## 验证清单

- [ ] 期号→ID映射正确构建
- [ ] calculateHistoricalStatsForIssue方法正确实现
- [ ] applyExclusionConditions中正确调用动态计算
- [ ] 移除全局preloadHistoricalStats调用
- [ ] 每个期号使用正确的历史数据起点
- [ ] 历史统计不包含当前预测期号
- [ ] 日志输出清晰显示ID-1基准点

## 实施步骤

1. 备份当前文件
2. 修复点1: 添加期号→ID映射缓存
3. 修复点2-4: 实现动态历史统计计算
4. 修复点5: 移除全局预加载调用
5. 重启应用测试
6. 验证每个期号的历史统计正确性

## 总结

**核心修改**：
- ❌ 旧逻辑：全局预加载，所有期号共用同一份历史数据
- ✅ 新逻辑：按期号动态计算，每个期号基于ID-1规则获取各自的历史数据

**关键原则**：
- 预测期号X → 历史统计从ID(X) - 1开始
- 历史数据不包含当前预测期号及之后的数据
- 符合真实预测场景（基于已知数据预测未知期号）
