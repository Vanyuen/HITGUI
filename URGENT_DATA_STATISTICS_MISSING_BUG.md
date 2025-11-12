# 🚨 紧急BUG：正选和排除统计数据完全缺失

**发现时间**: 2025-11-10
**严重程度**: 🔴 Critical
**影响范围**: 所有热温冷正选批量预测任务
**受影响任务数**: 今天创建的4个任务共84个期号结果

## 问题现象

用户报告期号25074有190,014个组合，怀疑数据有误。经诊断发现：

### 数据库现状（所有任务）
```
✗ exclusion_summary: 全部字段为0
✗ positive_selection_details: 全部字段为N/A
✗ paired_combinations: 全部为空数组
✗ 排除条件未生效: 19万组合应该被大幅削减
```

### 受影响任务统计

| 任务ID | 期号数 | 平均组合数 | 状态 |
|--------|--------|-----------|------|
| hwc-pos-20251110-8ku | 52期 | 162,092 | ⚠️ 全部异常 |
| hwc-pos-20251110-k98 | 12期 | 16,253 | ⚠️ 全部异常 |
| hwc-pos-20251110-vlh | 12期 | 23,199 | ⚠️ 全部异常 |
| hwc-pos-20251110-ews | 8期 | 0 | ⚠️ 全部异常 |

**期号25074详细数据**:
```
组合数: 190,014  ← 异常高！
正选后组合数: N/A
排除条件:
  ✗ 相克对排除: 0 (应该排除大量)
  ✗ 连号组数排除: 0 (已启用但未生效)
  ✗ 最长连号排除: 0 (已启用但未生效)
paired_combinations: 0 (应该有19万条)
```

## 根本原因

### 1. 方法只返回数组不返回统计信息

**`applyPositiveSelection` 方法** (`src/server/server.js:14532-14669`):
```javascript
async applyPositiveSelection(baseIssue, targetIssue, positiveSelection) {
    // Step 1-6 筛选逻辑
    log(`  ✅ Step1 热温冷比筛选: ${candidateIds.size}个组合`);
    log(`  ✅ Step2 区间比筛选: ${filteredCombos.length}个组合`);
    // ... 所有统计只打印日志

    return filteredCombos;  // ❌ 只返回数组，不返回统计信息！
}
```

**`applyExclusionConditions` 方法** (`src/server/server.js:14680+`):
```javascript
async applyExclusionConditions(baseIssue, combinations, exclusionConditions) {
    // 排除逻辑
    log(`  ✅ Exclude1 历史和值排除: ${excluded}条`);
    log(`  ✅ Exclude2 历史跨度排除: ${excluded}条`);
    // ... 所有统计只打印日志

    return filteredCombos;  // ❌ 只返回数组，不返回统计信息！
}
```

### 2. processBatch 期望获取但无法获取统计数据

**`processBatch` 方法** (`src/server/server.js:14915-14989`):
```javascript
async processBatch(...) {
    // 1. 正选
    let redCombinations = await this.applyPositiveSelection(...);
    // ❌ 无法获取 positive_selection_details

    // 2. 排除
    redCombinations = await this.applyExclusionConditions(...);
    // ❌ 无法获取 exclusion_summary

    batchResults.push({
        target_issue: targetIssue,
        red_combinations: redCombinations,
        // ❌ 缺少 exclusion_summary
        // ❌ 缺少 positive_selection_details
    });
}
```

### 3. processHwcPositiveTask 尝试保存不存在的字段

**`processHwcPositiveTask` 函数** (`src/server/server.js:16508-16509`):
```javascript
await HwcPositivePredictionTaskResult.create({
    exclusion_summary: periodResult.exclusion_summary || {},  // ← periodResult中没有！
    positive_selection_details: periodResult.positive_selection_details || {},  // ← periodResult中也没有！
    // ...
});
```

### 4. paired_combinations 计算但未包含在批次结果中

**问题**: `processHwcPositiveTask` 在保存时才计算 `paired_combinations`（lines 16455-16494），
但这发生在 `processBatch` 返回之后，导致：
- `processBatch` 返回的是组合对象数组
- `processHwcPositiveTask` 需要从这些对象提取数据构建配对
- 但 `processBatch` 已经消耗了大量内存，配对计算又要占用更多内存

## 为什么排除条件完全失效

虽然 `applyExclusionConditions` 可能执行了排除逻辑并返回了筛选后的数组，
但由于：
1. 没有返回统计信息，无法验证是否真的排除了数据
2. 从数据库数据看，组合数异常高（19万），说明排除可能根本没执行
3. 相克对排除、连号排除等复杂条件可能有BUG未被发现（因为没有统计反馈）

## 修复方案

###  方案A：重构方法返回对象（推荐）

#### Step 1: 修改 `applyPositiveSelection` 返回结构
```javascript
async applyPositiveSelection(baseIssue, targetIssue, positiveSelection) {
    const statistics = {
        step1_count: 0,
        step2_count: 0,
        step3_count: 0,
        step4_count: 0,
        step5_count: 0,
        step6_count: 0
    };

    // Step 1: 热温冷比
    let candidateIds = new Set();
    // ... 筛选逻辑
    statistics.step1_count = candidateIds.size;

    // Step 2: 区间比
    // ... 筛选逻辑
    statistics.step2_count = filteredCombos.length;

    // ... Step 3-6类似

    return {
        combinations: filteredCombos,
        statistics: statistics
    };
}
```

#### Step 2: 修改 `applyExclusionConditions` 返回结构
```javascript
async applyExclusionConditions(baseIssue, combinations, exclusionConditions) {
    const summary = {
        positive_selection_count: combinations.length,  // 输入数量
        sum_exclude_count: 0,
        span_exclude_count: 0,
        hwc_exclude_count: 0,
        zone_exclude_count: 0,
        conflict_exclude_count: 0,
        cooccurrence_exclude_count: 0,
        consecutive_groups_exclude_count: 0,
        max_consecutive_length_exclude_count: 0,
        final_count: 0
    };

    let remainingCombos = combinations;
    const initialCount = combinations.length;

    // Exclude 1: 历史和值
    if (exclusionConditions.sumExclusion?.enabled) {
        const beforeCount = remainingCombos.length;
        // ... 排除逻辑
        summary.sum_exclude_count = beforeCount - remainingCombos.length;
    }

    // ... 其他排除类似

    summary.final_count = remainingCombos.length;

    return {
        combinations: remainingCombos,
        summary: summary
    };
}
```

#### Step 3: 修改 `processBatch` 收集统计信息
```javascript
async processBatch(...) {
    // 1. 正选
    const positiveResult = await this.applyPositiveSelection(...);
    let redCombinations = positiveResult.combinations;
    const positiveStats = positiveResult.statistics;

    // 2. 排除
    const exclusionResult = await this.applyExclusionConditions(...);
    redCombinations = exclusionResult.combinations;
    const exclusionSummary = exclusionResult.summary;

    batchResults.push({
        target_issue: targetIssue,
        red_combinations: redCombinations,
        exclusion_summary: exclusionSummary,  // ✅ 添加
        positive_selection_details: positiveStats,  // ✅ 添加
        // ...
    });
}
```

### 方案B：临时快速修复（不推荐，治标不治本）

在 `processHwcPositiveTask` 中手动计算统计信息：
```javascript
// 保存前手动计算
const exclusion_summary = {
    positive_selection_count: periodResult.red_count,
    final_count: periodResult.red_count,
    // 其他字段默认为0（不准确但至少有值）
};

await HwcPositivePredictionTaskResult.create({
    exclusion_summary: exclusion_summary,
    // ...
});
```

**缺点**: 无法获取真实的排除统计，只是填充默认值

## 额外发现的问题

### paired_combinations 内存效率问题

当前实现在 `processHwcPositiveTask` 中构建配对（lines 16456-16494）：
```javascript
// 对于 truly-unlimited 模式
for (const redCombo of periodResult.red_combinations) {
    for (const blueCombo of periodResult.blue_combinations || []) {
        pairedCombinations.push({...});  // 笛卡尔积
    }
}
```

**问题**:
- 如果 `red_combinations` 有30万条，`blue_combinations` 有66条
- 会生成 30万 × 66 = 1980万 条配对记录
- 每条记录约100字节 = **1.98GB 内存**
- 保存到MongoDB会导致超大文档

**建议**:
1. 不要保存 truly-unlimited 模式的完整配对
2. 或使用分片存储（DLTExclusionDetails模式）
3. 或只保存红球/蓝球组合ID列表，前端按需组合

## 修复优先级

### P0 - 立即修复
1. **重构 `applyPositiveSelection` 返回统计信息** (方案A-Step1)
2. **重构 `applyExclusionConditions` 返回统计信息** (方案A-Step2)
3. **修改 `processBatch` 收集和传递统计信息** (方案A-Step3)

### P1 - 尽快修复
4. **验证排除条件是否真的执行**（通过日志或测试）
5. **修复 paired_combinations 内存问题**（可能需要新的存储策略）

### P2 - 后续优化
6. **添加单元测试验证统计信息准确性**
7. **优化日志输出格式，便于调试**

## 测试建议

修复后创建测试任务验证：
1. **小范围任务**（3-5期）验证统计信息是否正确保存
2. **检查数据库字段**:
   ```javascript
   positive_selection_details.step1_count > 0
   positive_selection_details.step6_count > 0
   exclusion_summary.conflict_exclude_count > 0  (如果启用)
   ```
3. **验证组合数合理性**:
   - 严格排除条件应该大幅削减组合数
   - 期号25074 有19万组合明显不正常
   - 正常应该在几千到几万之间

## 相关文件

- `src/server/server.js:14532-14669` - applyPositiveSelection
- `src/server/server.js:14680+` - applyExclusionConditions
- `src/server/server.js:14896-14989` - processBatch
- `src/server/server.js:16372-16576` - processHwcPositiveTask
- `src/server/server.js:1247-1346` - HwcPositivePredictionTaskResult Schema

---

**报告时间**: 2025-11-10
**报告人**: Claude Code
**用户反馈**: "期号25074有190,014个组合，数据是不是有误"
