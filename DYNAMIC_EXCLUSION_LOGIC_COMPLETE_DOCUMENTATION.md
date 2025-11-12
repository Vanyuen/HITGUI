# 批量预测动态排除逻辑 - 完整技术文档

**文档日期**: 2025-01-03
**目的**: 确保性能优化不影响动态排除逻辑的正确性
**关键原则**: 批量预测中每期的排除窗口独立、动态、基于不同的历史数据

---

## 🎯 核心概念：什么是"动态排除"

### 定义
在批量预测中，每期预测的排除规则基于**该期自己的历史窗口**，而非固定的预构建集合。

### 动态示例
```
预测25051期：历史窗口 = 25050及之前最近N期（例如：25050, 25049, ..., 25041）
预测25052期：历史窗口 = 25051及之前最近N期（例如：25051, 25050, ..., 25042）
预测25053期：历史窗口 = 25052及之前最近N期（例如：25052, 25051, ..., 25043）

⚠️ 每期的窗口在滑动，排除集合必然不同！
```

---

## 📋 五大动态排除功能详解

### 1️⃣ 历史和值排除（已验证 ✅）

#### 实现位置
- `buildRedQueryFromExcludeConditions()` 函数
- 约 server.js:6833-6850

#### 动态逻辑
```javascript
// 代码位置：server.js:6833-6850
if (exclude_conditions.sum?.historical?.enabled) {
    const recentPeriods = exclude_conditions.sum.historical.count || 10;

    // ⭐ 关键：基于 basePeriodID（目标期-1的ID）倒推
    const historicalRecords = await DLT.find({
        ID: { $lte: basePeriodID }  // <= 目标期-1
    })
    .sort({ ID: -1 })
    .limit(recentPeriods)  // 最近N期
    .lean();

    // 提取历史和值并添加到排除集合
    historicalRecords.forEach(record => {
        const sum = (record.Red1 || 0) + ... + (record.Red5 || 0);
        excludedSums.add(sum);
    });
}
```

#### 动态性验证
- ✅ 每期调用时传入不同的 `basePeriodID`
- ✅ 查询条件 `ID <= basePeriodID` 确保窗口动态滑动
- ✅ 每期的排除集合独立构建

#### 实际案例
```
预测25053期：
  - basePeriodID = 25052的ID（例如：2052）
  - 查询 ID <= 2052 的最近10期
  - 获得期号：25052, 25051, ..., 25043
  - 排除这些期号的和值

预测25054期：
  - basePeriodID = 25053的ID（例如：2053）
  - 查询 ID <= 2053 的最近10期
  - 获得期号：25053, 25052, ..., 25044
  - 排除这些期号的和值（与上一期不同！）
```

---

### 2️⃣ 历史跨度/区间比排除（已验证 ✅）

#### 实现位置
- 与历史和值类似，在 `buildRedQueryFromExcludeConditions()` 中
- 约 server.js:6900-7000

#### 动态逻辑
```javascript
// 跨度排除
if (exclude_conditions.span?.historical?.enabled) {
    const recentPeriods = exclude_conditions.span.historical.count || 10;

    const historicalRecords = await DLT.find({
        ID: { $lte: basePeriodID }  // ⭐ 动态基准
    })
    .sort({ ID: -1 })
    .limit(recentPeriods)
    .lean();

    historicalRecords.forEach(record => {
        const redBalls = [record.Red1, ..., record.Red5];
        const span = Math.max(...redBalls) - Math.min(...redBalls);
        excludedSpans.add(span);
    });
}

// 区间比排除（类似逻辑）
if (exclude_conditions.zone?.historical?.enabled) {
    // ... 同样基于 basePeriodID 动态查询
}
```

#### 动态性保证
- ✅ 同历史和值，基于动态的 `basePeriodID`
- ✅ 每期窗口独立滑动

---

### 3️⃣ 历史热温冷比排除（已验证 ✅）

#### 实现位置
- `getHistoricalHWCRatios()` 全局函数
- 约 server.js:17339-17359

#### 动态逻辑
```javascript
// 代码位置：server.js:17339-17359
async function getHistoricalHWCRatios(recentCount, beforePeriodID) {
    // ⭐ 关键：查询 ID < beforePeriodID（目标期的前一期ID）
    const issues = await DLTRedMissing.find({
        ID: { $lt: beforePeriodID }  // 小于目标期ID
    })
    .sort({ ID: -1 })
    .limit(recentCount)
    .lean();

    const hwcRatios = new Set();
    issues.forEach(issue => {
        if (issue.FrontHotWarmColdRatio) {
            hwcRatios.add(issue.FrontHotWarmColdRatio);
        }
    });

    return Array.from(hwcRatios);
}
```

#### 调用链
```javascript
// StreamBatchPredictor.getFilteredRedCombinations()
// 约 server.js:12192-12196
if (exclude_conditions.hwc.historical && exclude_conditions.hwc.historical.enabled) {
    const historicalRatios = await this.getHistoricalHWCRatios(
        issue,  // ⭐ 每期传入不同的期号
        exclude_conditions.hwc.historical.count
    );
    excludedHWCRatios.push(...historicalRatios);
}

// getHistoricalHWCRatios 适配器（实例方法）
// 约 server.js:12280-12295
async getHistoricalHWCRatios(targetIssue, count) {
    const targetRecord = await DLT.findOne({ Issue: parseInt(targetIssue) }).lean();
    if (!targetRecord) return [];

    // 调用全局函数，传入该期的ID
    return await getHistoricalHWCRatios(count, targetRecord.ID);  // ⭐ 动态ID
}
```

#### 动态性验证
- ✅ 每期调用时传入不同的 `targetIssue`
- ✅ 查询条件 `ID < beforePeriodID` 确保窗口动态
- ✅ 每期获取不同的热温冷比集合

---

### 4️⃣ 相克对排除（已验证 ✅ 动态构建）

#### 实现位置
- `StreamBatchPredictor.getConflictPairs()` 方法
- 约 server.js:12903-13100

#### 动态逻辑
```javascript
// 代码位置：server.js:12903-13100
async getConflictPairs(targetIssue, conflictConfig) {
    const { globalAnalysisPeriods, perBallAnalysisPeriods } = conflictConfig;

    const maxPeriods = Math.max(globalAnalysisPeriods, perBallAnalysisPeriods);

    // ⭐ 关键1：基于目标期号动态查询历史数据
    const targetIssueNum = parseInt(targetIssue);
    const analysisData = await DLT.find({
        Issue: { $lt: targetIssueNum }  // 小于目标期号
    })
    .sort({ Issue: -1 })
    .limit(maxPeriods)  // 分析最近N期
    .lean();

    // ⭐ 关键2：实时统计相克关系
    const conflictMatrix = {};
    for (let i = 1; i <= 35; i++) {
        conflictMatrix[i] = {};
        for (let j = 1; j <= 35; j++) {
            if (i !== j) conflictMatrix[i][j] = 0;
        }
    }

    // 遍历历史数据，统计相克次数
    analysisData.forEach(record => {
        const redNumbers = [record.Red1, ..., record.Red5];
        for (let appeared = 1; appeared <= 35; appeared++) {
            if (redNumbers.includes(appeared)) {
                for (let notAppeared = 1; notAppeared <= 35; notAppeared++) {
                    if (appeared !== notAppeared && !redNumbers.includes(notAppeared)) {
                        conflictMatrix[appeared][notAppeared]++;  // 累加相克次数
                    }
                }
            }
        }
    });

    // ⭐ 关键3：动态排序获取TopN相克对
    const conflictScores = [];
    for (let a = 1; a <= 35; a++) {
        for (let b = a + 1; b <= 35; b++) {
            const score = conflictMatrix[a][b] + conflictMatrix[b][a];
            if (score > 0) {
                conflictScores.push({ ball1: a, ball2: b, score });
            }
        }
    }

    conflictScores.sort((x, y) => y.score - x.score);  // 降序排序
    const topConflictPairs = conflictScores.slice(0, topN);  // 取TopN

    // 返回相克对数组
    return topConflictPairs.map(item => [item.ball1, item.ball2]);
}
```

#### 动态性验证
- ✅ **每期实时查询**：`Issue < targetIssueNum`，不同期号查询不同历史范围
- ✅ **实时统计**：每次调用都重新遍历历史数据计算相克矩阵
- ✅ **动态排序**：每次重新排序获取TopN，不使用预构建数据
- ✅ **热号保护**：基于当前期的历史数据实时统计热号

#### 实际案例
```
预测25053期，分析最近50期（globalAnalysisPeriods=50）：
  - 查询 Issue < 25053 的最近50期
  - 获得：25052, 25051, ..., 25003
  - 遍历这50期，统计相克矩阵
  - 排序获取Top10相克对（例如：[01-15], [03-22], ...）

预测25054期，分析最近50期：
  - 查询 Issue < 25054 的最近50期
  - 获得：25053, 25052, ..., 25004（窗口滑动了1期）
  - 重新统计相克矩阵（可能与上一期不同）
  - 重新排序获取Top10（结果可能不同）
```

#### ⚠️ 不可预构建的原因
1. **窗口动态**：每期分析的历史范围不同
2. **实时排序**：TopN排名基于实时统计，无法提前固定
3. **配置多样**：globalAnalysisPeriods、perBallAnalysisPeriods、topN 可变
4. **热号保护**：热号榜单基于每期的历史窗口实时计算

---

### 5️⃣ 同出组合排除（已验证 ✅ 动态构建）

#### 实现位置
- `StreamBatchPredictor.getExcludeComboFeaturesPerBall()` 方法（按红球）
- 约 server.js:12696-12809
- `StreamBatchPredictor.getExcludeComboFeaturesByIssues()` 方法（按期号）
- 约 server.js:12550-12650

#### 动态逻辑（按红球）
```javascript
// 代码位置：server.js:12696-12809
async getExcludeComboFeaturesPerBall(targetIssue, periods, options = {}) {
    // ⭐ 关键1：调用同出API，传入目标期号
    const url = `http://localhost:3003/api/dlt/cooccurrence-per-ball?targetIssue=${targetIssue}&periods=${periods}`;
    const response = await fetch(url);
    const result = await response.json();

    // API内部动态逻辑（server.js:3987-4150）：
    // 1. 查询目标期号的前一期遗漏值数据
    // 2. 对每个红球（1-35），找到最近出现的期号
    // 3. 从该期号开始倒推N次出现，收集同出号码
    // 4. 返回每个红球的同出分析结果

    const analyzedDetailsObj = result.data.analyzedDetails || {};
    const analyzedDetails = Object.values(analyzedDetailsObj);

    // ⭐ 关键2：从同出分析中提取涉及的期号
    const allIssues = new Set();
    analyzedDetails.forEach(detail => {
        if (detail.lastAppearedIssue) {
            allIssues.add(detail.lastAppearedIssue);  // 每期分析涉及不同的期号
        }
    });

    const issuesList = Array.from(allIssues);
    log(`🎯 涉及的期号数: ${issuesList.length}`);

    // ⭐ 关键3：查询这些期号的组合特征（动态特征集合）
    const features = await DLTComboFeatures.find({
        Issue: { $in: issuesList }  // 不同期号查询不同特征
    }).lean();

    // 聚合待排除的特征
    const excludeFeatures = {
        combo_2: new Set(),
        combo_3: new Set(),
        combo_4: new Set()
    };

    features.forEach(record => {
        if (record.combo_2) {
            record.combo_2.forEach(feature => excludeFeatures.combo_2.add(feature));
        }
        if (record.combo_3) {
            record.combo_3.forEach(feature => excludeFeatures.combo_3.add(feature));
        }
        if (record.combo_4) {
            record.combo_4.forEach(feature => excludeFeatures.combo_4.add(feature));
        }
    });

    return { excludeFeatures, analyzedDetails, sampleFeatures: [] };
}
```

#### 同出API内部动态逻辑
```javascript
// 位置：server.js:3987-4150
// API: /api/dlt/cooccurrence-per-ball

// ⭐ 对每个红球（1-35）：
for (let ballNum = 1; ballNum <= 35; ballNum++) {
    // 1. 从目标期的前一期开始查找该球最近出现的期号
    const previousIssue = parseInt(targetIssue) - 1;
    const missingValue = getMissingValue(previousIssue, ballNum);
    const lastAppearedIssue = previousIssue - missingValue;

    // 2. 从该期号开始，倒推最近N次出现
    const appearances = [];
    let currentIssue = lastAppearedIssue;
    let count = 0;

    while (count < periods && currentIssue > 0) {
        const record = await DLT.findOne({ Issue: currentIssue });
        if (record && record.Red包含该球号) {
            appearances.push({
                issue: currentIssue,
                coOccurredNumbers: record.Red数组.filter(n => n !== ballNum)
            });
            count++;
        }
        currentIssue--;  // 继续往前找
    }

    // 3. 收集同出号码
    const coOccurredSet = new Set();
    appearances.forEach(app => {
        app.coOccurredNumbers.forEach(num => coOccurredSet.add(num));
    });

    analyzedDetails[ballNum] = {
        ballNumber: ballNum,
        lastAppearedIssue: lastAppearedIssue,
        coOccurredNumbers: Array.from(coOccurredSet)
    };
}
```

#### 动态性验证
- ✅ **每期独立分析**：`targetIssue` 不同，每个红球的最近出现期号不同
- ✅ **实时查询遗漏值**：基于目标期-1的遗漏值数据，动态确定最近出现期号
- ✅ **倒推逻辑**：从最近出现期号开始倒推N次出现，窗口独立
- ✅ **动态特征集合**：涉及的期号不同，查询的组合特征不同

#### 实际案例
```
预测25053期，每个红球最近10次出现：

  球号01：
    - 基准期：25052（目标期-1）
    - 查遗漏值：Ball_01 = 3（3期未出）
    - 最近出现：25052 - 3 = 25049期
    - 倒推10次：从25049往前找10次01出现的期号
    - 涉及期号：例如 25049, 25045, 25042, ..., 25010
    - 同出号码：这些期号中与01同时出现的号码

  球号02：
    - 基准期：25052
    - 查遗漏值：Ball_02 = 1（1期未出）
    - 最近出现：25052 - 1 = 25051期
    - 倒推10次：从25051往前找10次02出现的期号
    - 涉及期号：例如 25051, 25048, 25044, ..., 25012（不同！）
    - 同出号码：这些期号中与02同时出现的号码

  ...（35个红球独立分析）

  最终：查询所有涉及期号的组合特征，聚合为排除集合

预测25054期，每个红球最近10次出现：

  球号01：
    - 基准期：25053（目标期-1，窗口滑动）
    - 查遗漏值：Ball_01 = 4（假设又未出）
    - 最近出现：25053 - 4 = 25049期
    - 倒推10次：从25049往前找10次01出现
    - 涉及期号可能与25053期相同或不同（取决于25053是否开出01）

  球号02：
    - 基准期：25053（窗口滑动）
    - 查遗漏值：Ball_02 = 0（假设开出）
    - 最近出现：25053期
    - 倒推10次：从25053往前找10次02出现（窗口完全不同！）
    - 涉及期号：例如 25053, 25051, 25048, ...（与25053期不同）
```

#### ⚠️ 不可预构建的原因
1. **遗漏值动态**：每期的遗漏值不同，最近出现期号不同
2. **倒推路径独立**：每个球号、每期的倒推路径完全独立
3. **涉及期号不固定**：无法预知哪些期号会被涉及
4. **组合特征查询动态**：涉及期号不同，查询的特征集合不同

---

## 📊 五大功能动态性总结表

| 排除功能 | 动态窗口基准 | 查询逻辑 | 动态性 | 可否预构建 |
|---------|------------|---------|--------|-----------|
| **历史和值** | basePeriodID（目标期-1的ID） | `ID <= basePeriodID` 倒推N期 | ✅ 每期窗口滑动 | ❌ 不可 |
| **历史跨度** | basePeriodID | `ID <= basePeriodID` 倒推N期 | ✅ 每期窗口滑动 | ❌ 不可 |
| **历史热温冷比** | beforePeriodID（目标期ID） | `ID < beforePeriodID` 倒推N期 | ✅ 每期窗口滑动 | ❌ 不可 |
| **历史区间比** | basePeriodID | `ID <= basePeriodID` 倒推N期 | ✅ 每期窗口滑动 | ❌ 不可 |
| **相克对** | targetIssue | `Issue < targetIssue` 倒推N期，实时统计排序 | ✅ 每期重新计算TopN | ❌ 不可 |
| **同出组合（按红球）** | targetIssue | 查遗漏值→找最近出现→倒推N次→查组合特征 | ✅ 每球每期独立倒推 | ❌ 不可 |
| **同出组合（按期号）** | targetIssue | `ID <  targetIssue.ID` 倒推N期 → 查组合特征 | ✅ 每期窗口滑动 | ❌ 不可 |

---

## 🚀 性能优化策略（保证动态性）

### ✅ 可以优化的（不影响动态性）

#### 1. 遗漏值查询优化（已实施 ✅）
**原理**: 预加载遗漏值数据到Map索引，查询从O(n) → O(1)
```javascript
// 优化前：
const missingRecord = missingDataArray.find(r => r.Issue === previousIssue); // O(n)

// 优化后：
const missingMap = globalCacheManager.getIssueMissingMap(previousIssue); // O(1)
```
**动态性**: ✅ 不影响，仅加速查询速度

#### 2. 历史数据批量预加载（可实施）
**原理**: 一次性查询所有需要的历史期号数据，运行时从缓存中动态提取
```javascript
// 预加载：批量查询最小目标期之前的所有历史数据
const historicalRecords = await DLT.find({
    Issue: { $lt: minTargetIssue }
}).sort({ Issue: -1 }).limit(maxHistoricalPeriods + 100).lean();

// 构建索引：Issue -> Record
const historicalCache = new Map();
historicalRecords.forEach(r => {
    historicalCache.set(r.Issue.toString(), {
        sum: ...,
        span: ...,
        zoneRatio: ...
    });
});

// 运行时动态提取（每期调用）：
function getDynamicHistoricalExclusionSet(targetIssue, condition, periods) {
    const excludeSet = new Set();
    for (let issue = targetIssue - 1; issue > 0 && count < periods; issue--) {
        const record = historicalCache.get(issue.toString());
        if (record) {
            excludeSet.add(record[condition]); // 动态构建该期的排除集合
            count++;
        }
    }
    return excludeSet; // 每期返回不同的排除集合
}
```
**动态性**: ✅ 不影响，每期仍然动态构建独立的排除集合

#### 3. 热温冷比优化表批量预加载（可实施）
**原理**: 批量查询所有相关期号对的热温冷比数据
```javascript
// 预加载：批量查询所有 (base_issue, target_issue) 对的热温冷比
const hwcData = await DLTRedCombinationsHotWarmColdOptimized.find({
    base_issue: { $in: baseIssues },  // 所有目标期-1
    target_issue: { $in: targetIssues }  // 所有目标期
}).lean();

// 构建索引：base_issue -> target_issue -> comboId -> ratio
const hwcCache = new Map();
hwcData.forEach(record => {
    // 三层Map结构
});

// 运行时查询（每期调用）：
const ratio = hwcCache.get(baseIssue)?.get(targetIssue)?.get(comboId); // O(1)
```
**动态性**: ✅ 不影响，每期使用不同的base_issue和target_issue组合

#### 4. 命中验证并行化（可实施）
**原理**: 批量查询所有期号的开奖数据，并行计算命中
```javascript
// 批量查询开奖数据（单次查询）
const winningData = await DLT.find({
    Issue: { $in: allTargetIssues }
}).lean();

// 并行计算命中（利用多核）
const validationPromises = allTargetIssues.map(issue => {
    return calculateHitAnalysis(issue, ...);
});
const results = await Promise.all(validationPromises);
```
**动态性**: ✅ 不影响，独立的验证流程

---

### ❌ 不能优化的（会破坏动态性）

#### 1. 预构建固定的相克对排除集合
**错误示例**:
```javascript
// ❌ 错误：预先为所有期号构建固定的TopN相克对
const conflictPairsCache = new Map();
targetIssues.forEach(issue => {
    const top10 = calculateTop10ConflictPairs(issue, 50); // 固定TopN
    conflictPairsCache.set(issue, top10);
});
```
**为什么错误**:
- TopN排名基于实时统计，窗口滑动会改变排名
- 热号保护基于动态热号榜单，无法固定
- 用户配置（periods、topN）可变

#### 2. 预构建固定的同出特征集合
**错误示例**:
```javascript
// ❌ 错误：预先为每个期号构建同出特征集合
const coOccurFeaturesCache = new Map();
targetIssues.forEach(issue => {
    const features = calculateCoOccurFeatures(issue, 10); // 固定特征
    coOccurFeaturesCache.set(issue, features);
});
```
**为什么错误**:
- 每个红球的倒推路径独立且动态
- 遗漏值实时变化，最近出现期号不固定
- 涉及的历史期号无法预知

---

## 🔒 性能优化安全原则

### 优化准则
1. **数据预加载 ✅**：可以批量预加载原始数据到缓存
2. **索引加速 ✅**：可以构建索引加速查询速度（O(n) → O(1)）
3. **运行时动态构建 ✅**：每期必须从缓存中动态提取数据并构建排除集合
4. **结果预构建 ❌**：绝对不能预先构建固定的排除集合

### 安全检查清单
- [ ] 每期是否使用不同的历史窗口？
- [ ] 排除集合是否在运行时动态构建？
- [ ] 相同参数是否产生相同输出？
- [ ] 不同期号是否产生不同排除集合？

---

## 📝 实施验证方法

### 测试用例
```javascript
// 测试动态性：相邻两期的排除集合应不同
async function testDynamicExclusion() {
    const issue1 = '25053';
    const issue2 = '25054';
    const periods = 10;

    // 获取两期的历史和值排除集合
    const exclude1 = await getHistoricalSumExclusion(issue1, periods);
    const exclude2 = await getHistoricalSumExclusion(issue2, periods);

    // 断言：两期的排除集合应不完全相同
    const diff = symmetricDifference(exclude1, exclude2);
    assert(diff.size > 0, '相邻两期的排除集合应有差异');

    // 例如：
    // exclude1 = Set([85, 90, 95, 100, ...]) // 基于25052-25043
    // exclude2 = Set([88, 90, 95, 102, ...]) // 基于25053-25044
    // diff = Set([85, 88, 100, 102]) // 滑动窗口导致的差异
}
```

---

## 🎯 总结

### 核心结论
1. **历史和值/跨度/热温冷比/区间比**: 基于动态的basePeriodID，每期窗口滑动
2. **相克对**: 每期实时查询历史、统计相克矩阵、动态排序TopN
3. **同出组合**: 每个红球、每期独立倒推路径，涉及期号动态变化

### 优化方向
- ✅ **数据预加载**: 批量查询原始数据（历史开奖、遗漏值、组合特征）
- ✅ **索引加速**: 构建Map索引加速查询速度
- ✅ **运行时构建**: 每期从缓存动态提取数据并构建排除集合
- ❌ **结果预构建**: 绝对禁止预先构建固定排除集合

### 安全保证
- ✅ 动态性100%保持
- ✅ 业务逻辑不变
- ✅ 每期独立窗口
- ✅ 相同输入相同输出

---

**文档作者**: Claude Code
**验证状态**: 已深入分析源码验证
**文档版本**: v1.0 Complete
**最后更新**: 2025-01-03
