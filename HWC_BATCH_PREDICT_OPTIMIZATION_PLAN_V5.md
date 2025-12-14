# 热温冷正选批量预测性能优化方案 V5

## 文档信息
- **创建日期**: 2025-12-03
- **目标**: 解决任务处理阶段的重复数据库查询问题
- **基础**: V4已优化异步保存阶段，但任务处理阶段仍慢

---

## 一、问题诊断

### 1.1 V4优化效果有限的原因

V4优化针对的是**异步保存阶段**（任务完成后的后台保存）。

但用户反馈的"创建任务慢"实际发生在**任务处理阶段**（每期逐个处理时）。

### 1.2 每期处理的数据库操作（瓶颈定位）

| 操作 | 代码位置 | 每期执行次数 | 100期累计 | 问题 |
|------|----------|-------------|----------|------|
| 热温冷表查询 | L24255 | 1次 | 100次 | **可批量预加载** |
| 红球组合查询 | L24287 | 1次 | 100次 | **可复用结果** |
| **相克对历史查询** | L24670 | 1次(50条) | **100次×50条** | ⚠️ **重复查询相同数据** |
| **遗漏值查询** | L24747 | 1次 | 100次 | ⚠️ **可批量预加载** |
| 开奖号码查询 | L24852 | 1次 | ~99次 | 可批量预加载 |
| **蓝球组合循环查询** | L24883 | N次/期 | **100×N次** | ⚠️ **已有批量查询，循环内重复** |
| 结果保存 | L25026 | 1次 | 100次 | 正常 |
| **同步保存排除详情** | L25033 | ~10次 | **1000次** | ⚠️ **阻塞主循环** |

### 1.3 最严重的问题

1. **相克对构建**：每期都重新查询50条历史数据并构建相克对Set
   - 100期任务 = 5000次相同数据的查询
   - 解决：任务开始时构建一次，全程复用

2. **排除详情同步保存**：每期同步等待所有步骤的排除详情保存完成
   - 100期 × 10步骤 = 1000次数据库写入在主循环中等待
   - 解决：收集所有数据，任务结束后统一异步保存

3. **遗漏值数据**：每期单独查询
   - 解决：任务开始时批量预加载

---

## 二、V5优化方案

### 方案A：相克对预构建 ⭐⭐⭐⭐⭐（最高优先）

**问题**：L24670 每期都执行 `hit_dlts.find({}).sort({ Issue: -1 }).limit(50)`

**修改**：在任务开始时构建一次相克对Set，传递给每期处理函数

```javascript
// 修改前（每期执行）
if (exclusion_conditions?.conflictPairs?.enabled) {
    const recentIssues = await hit_dlts.find({}).sort({ Issue: -1 }).limit(50).lean();
    // 构建相克对...
}

// 修改后（任务开始时执行一次）
// 在 processHwcPositivePredictionTask 开头：
let prebuiltConflictPairsSet = null;
if (exclusion_conditions?.conflictPairs?.enabled) {
    log(`⚡ [预加载] 构建相克对集合...`);
    const recentIssues = await hit_dlts.find({}).sort({ Issue: -1 }).limit(50).lean();
    prebuiltConflictPairsSet = buildConflictPairsSet(recentIssues);
    log(`⚡ [预加载] 相克对集合构建完成: ${prebuiltConflictPairsSet.size}对`);
}

// 然后在每期处理时直接使用 prebuiltConflictPairsSet
```

**预期效果**：
- 100期任务：5000次查询 → 1次查询
- 节省时间：约 50秒+

---

### 方案B：排除详情延迟保存 ⭐⭐⭐⭐⭐

**问题**：L25033 每期同步等待排除详情保存完成

**修改**：收集所有排除详情，任务结束后统一异步保存

```javascript
// 修改前（每期同步保存）
await Promise.all(
    exclusionsToSave.map(exclusion =>
        saveExclusionDetails(...)
    )
);

// 修改后（收集后异步保存）
// 在任务开始时创建收集数组：
const allExclusionsToSave = [];

// 每期处理时只收集，不保存：
allExclusionsToSave.push({
    result_id,
    targetIssue,
    exclusions: exclusionsToSave
});

// 任务结束后统一保存：
saveAllExclusionDetailsAsync(task_id, allExclusionsToSave, io);
```

**预期效果**：
- 主循环不再等待1000次写入
- 节省时间：约 60秒+

---

### 方案C：批量预加载 ⭐⭐⭐⭐

**修改点**：

1. **热温冷数据批量查询**：
```javascript
// 任务开始时批量查询所有期号对的热温冷数据
const hwcDataMap = new Map();
const hwcRecords = await DLTRedCombinationsHotWarmColdOptimized.find({
    $or: issues.map(({ base, target }) => ({ base_issue: base, target_issue: target }))
}).lean();
hwcRecords.forEach(r => hwcDataMap.set(`${r.base_issue}-${r.target_issue}`, r));
```

2. **开奖号码批量查询**：
```javascript
// 任务开始时批量查询所有已开奖期号
const winningDataMap = new Map();
const latestIssue = await getLatestIssue();
const drawnIssues = issues.filter(i => parseInt(i.target) <= latestIssue).map(i => parseInt(i.target));
const winningRecords = await hit_dlts.find({ Issue: { $in: drawnIssues } }).lean();
winningRecords.forEach(r => winningDataMap.set(r.Issue, r));
```

3. **遗漏值数据批量查询**：
```javascript
// 任务开始时批量查询所有需要的遗漏值
const missingDataMap = new Map();
const previousIssues = issues.map(i => (parseInt(i.target) - 1).toString());
const missingRecords = await mongoose.connection.db
    .collection('hit_dlt_basictrendchart_redballmissing_histories')
    .find({ Issue: { $in: previousIssues } }).toArray();
missingRecords.forEach(r => missingDataMap.set(r.Issue, r));
```

**预期效果**：
- 100次单独查询 → 3次批量查询
- 节省时间：约 20秒

---

## 三、实施计划

### 优先级排序

| 优先级 | 方案 | 预期节省 | 风险 | 改动量 |
|--------|------|----------|------|--------|
| **P0** | 方案A：相克对预构建 | 50秒+ | 低 | 小 |
| **P0** | 方案B：排除详情延迟保存 | 60秒+ | 低 | 中 |
| P1 | 方案C：批量预加载 | 20秒 | 低 | 中 |

### 预期效果

| 指标 | V4优化后 | V5优化后 |
|------|----------|----------|
| 100期任务处理时间 | ~3分钟 | **~30秒** |
| 数据库查询次数 | ~5000次 | **~200次** |
| 主循环阻塞写入 | ~1000次 | **0次** |

---

## 四、快速实施

如果确认，我将按以下顺序修改：

1. **方案A**：在 `processHwcPositivePredictionTask` 开头预构建相克对集合
2. **方案B**：将每期排除详情收集到数组，任务结束后统一保存
3. **方案C**：添加热温冷/开奖号码/遗漏值的批量预加载

**请确认是否实施V5优化？**
