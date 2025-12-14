# 热温冷正选批量预测性能优化方案 V4

## 文档信息
- **创建日期**: 2025-12-03
- **目标**: 解决大规模期号批量预测时创建任务慢、写入数据库慢的问题
- **基础**: 在V3双层策略基础上进一步优化

---

## 一、现状分析

### 1.1 V3已实施的优化（确认）

| 优化项 | 状态 | 说明 |
|--------|------|------|
| 双层保存策略 | ✅ 已实施 | 完整详情（top_hit 10期+推算期）+ 轻量详情（仅excludedIds） |
| 异步保存机制 | ✅ 已实施 | 任务完成后后台保存排除详情 |
| 智能存储策略 | ✅ 已实施 | inline(<5MB) / compressed(5-16MB) / chunked(>16MB) |
| 分批插入 | ✅ 已实施 | 每批3条，带重试机制 |
| 轻量详情 | ✅ 已实施 | 只保存excludedIds，detailsMap按需生成 |

### 1.2 当前瓶颈（精准定位）

| 瓶颈点 | 位置 | 当前值 | 问题 |
|--------|------|--------|------|
| **insertMany批次延迟** | L24031 | 300ms/批 | 累计耗时大 |
| **轻量详情批次延迟** | L18775 | 500ms/批 | 累计耗时大 |
| **insertMany批次大小** | L24002 | 3条/批 | 批次过小 |
| **轻量详情批次大小** | L18725 | 5期/批 | 批次过小 |
| **进度更新频率** | L18843 | 每期更新 | 数据库IO多 |

### 1.3 延迟累计分析

假设100期任务（top_hit=10）：
- 完整详情：11期（10期top_hit + 1期推算）
- 轻量详情：约20期（20%比例限制）

```
轻量详情保存:
├── 期号数: 20期
├── 批次: 20/5 = 4批
├── 批次延迟: 4 × 500ms = 2秒
├── 每期保存耗时: ~2秒 × 20期 = 40秒
└── 小计: ~42秒

完整详情保存:
├── 期号数: 11期
├── 每期约6个步骤
├── 每步骤insertMany: ~3批次 × 300ms = 0.9秒
├── 11期 × 6步骤 × 0.9秒 = 59秒
├── 进度更新: 11次 × 100ms = 1.1秒
└── 小计: ~60秒

总计异步保存: ~100秒（约1.5分钟）
```

**问题**：延迟设置过于保守，导致不必要的等待。

---

## 二、优化方案

### 方案A：调整延迟参数（立即可做）⭐⭐⭐⭐⭐

#### 修改点

| 参数 | 当前值 | 建议值 | 位置 |
|------|--------|--------|------|
| `INSERT_BATCH_SIZE` | 3 | **10** | L24002 |
| insertMany批次延迟 | 300ms | **50ms** | L24031 |
| `LIGHTWEIGHT_BATCH_SIZE` | 5 | **10** | L18725 |
| 轻量详情批次延迟 | 500ms | **100ms** | L18775 |
| 进度更新频率 | 每期 | **每5期** | L18843 |

#### 预期效果

```
优化后轻量详情保存:
├── 批次: 20/10 = 2批
├── 批次延迟: 2 × 100ms = 0.2秒
├── 每期保存耗时优化
└── 小计: ~15秒（原42秒，提升60%）

优化后完整详情保存:
├── 每步骤insertMany: ~1批次 × 50ms = 0.05秒
├── 11期 × 6步骤 × 0.05秒 = 3.3秒
├── 进度更新: 3次 × 100ms = 0.3秒
└── 小计: ~20秒（原60秒，提升70%）

优化后总计: ~35秒（原100秒，提升65%）
```

#### 代码修改

```javascript
// 位置: src/server/server.js

// 修改1: L24002 - 增大insertMany批次
const INSERT_BATCH_SIZE = 10;   // 原3条，改为10条

// 修改2: L24031 - 减少insertMany延迟
await new Promise(r => setTimeout(r, 50));  // 原300ms，改为50ms

// 修改3: L18725 - 增大轻量详情批次
const LIGHTWEIGHT_BATCH_SIZE = 10;  // 原5期，改为10期

// 修改4: L18775 - 减少轻量详情延迟
await new Promise(resolve => setTimeout(resolve, 100));  // 原500ms，改为100ms

// 修改5: L18843 - 减少进度更新频率
if (savedCount % 5 === 0 || savedCount === periodsToSave.size) {
    // 每5期或最后一期才更新进度
    await HwcPositivePredictionTask.updateOne(...);
    io.emit('hwc-exclusion-details-progress', ...);
}
```

---

### 方案B：并行保存轻量详情 ⭐⭐⭐⭐

#### 核心思路
轻量详情（只有excludedIds）体积小，可以多期并行保存。

```javascript
// 位置: saveExclusionDetailsAsync() 函数

// 原来: 串行保存每期
for (const period of lightweightArray) {
    await saveExclusionDetailsBatch(...);  // 串行等待
}

// 改为: 并行保存（控制并发数）
const pLimit = require('p-limit');
const limit = pLimit(5);  // 最大5并发

await Promise.all(
    lightweightArray.map(period =>
        limit(() => saveExclusionDetailsBatch(taskId, resultId, period, exclusions))
    )
);
```

#### 预期效果
- 20期轻量详情：从串行40秒 → 并行8秒（5并发）
- 提升：80%

---

### 方案C：批量insertMany优化 ⭐⭐⭐⭐

#### 核心思路
将多期的小文档合并为一次insertMany操作。

```javascript
// 原来: 每期分别insertMany
for (const period of periods) {
    await DLTExclusionDetails.insertMany(periodDocs);  // 多次调用
}

// 改为: 收集所有文档，一次insertMany
const allDocs = [];
for (const period of periods) {
    allDocs.push(...periodDocs);
}
// 一次性插入（按5000条分批）
for (let i = 0; i < allDocs.length; i += 5000) {
    await DLTExclusionDetails.insertMany(allDocs.slice(i, i + 5000), { ordered: false });
}
```

#### 预期效果
- 减少MongoDB连接开销
- 减少await等待次数
- 预期提升：50%

---

### 方案D：结果文档瘦身 ⭐⭐⭐

#### 问题分析
`HwcPositivePredictionTaskResult` 保存了 `paired_combinations` 完整数组，可能包含数万条数据。

```javascript
// 当前保存（大）:
{
    paired_combinations: [
        { red_combo_id: 1, red_balls: [1,2,3,4,5], blue_combo_id: 1, blue_balls: [1,2], ... },
        // ... 数万条
    ]
}

// 优化后（小）:
{
    retained_red_combo_ids: [1, 2, 3, ...],  // 只保存ID
    blue_combination_count: 66,
    pairing_mode: "default"
    // 完整数据在导出Excel时按需查询
}
```

#### 修改点

```javascript
// 位置: processHwcPositivePredictionTask() 保存结果处

const result = new HwcPositivePredictionTaskResult({
    result_id,
    task_id,
    period: parseInt(targetIssue),
    is_predicted: isPredicted,
    combination_count: combinationCount,

    // 原来: 保存完整配对数据（大）
    // paired_combinations: pairedCombinationsData,

    // 改为: 只保存红球组合ID（小）
    retained_red_combo_ids: combinations.map(c => c.combination_id),
    blue_combination_count: 66,
    pairing_mode: pairingMode,

    // 其他字段保持不变
    hit_analysis: hitAnalysis,
    // ...
});
```

#### 预期效果
- 每期结果从~5MB → ~100KB
- 单期保存时间从~500ms → ~50ms
- 总体提升：90%

---

## 三、实施计划

### 阶段1：参数调优（方案A）- 30分钟

| 步骤 | 修改 | 风险 |
|------|------|------|
| 1 | 调整INSERT_BATCH_SIZE: 3→10 | 低 |
| 2 | 调整insertMany延迟: 300ms→50ms | 低 |
| 3 | 调整LIGHTWEIGHT_BATCH_SIZE: 5→10 | 低 |
| 4 | 调整轻量详情延迟: 500ms→100ms | 低 |
| 5 | 减少进度更新频率: 每期→每5期 | 低 |

### 阶段2：并行优化（方案B）- 30分钟

| 步骤 | 修改 | 风险 |
|------|------|------|
| 1 | 轻量详情改为并行保存 | 中（需测试并发数） |
| 2 | 添加并发控制（p-limit） | 低 |

### 阶段3：结构优化（方案D）- 1小时

| 步骤 | 修改 | 风险 |
|------|------|------|
| 1 | Schema新增 retained_red_combo_ids 字段 | 低 |
| 2 | 修改保存逻辑，不再保存完整paired_combinations | 中 |
| 3 | 修改Excel导出，按需查询完整数据 | 中 |
| 4 | 前端适配新数据结构 | 低 |

---

## 四、预期效果

| 指标 | 当前 | 方案A后 | 方案A+B后 | 全部优化后 |
|------|------|---------|----------|-----------|
| 异步保存耗时 | ~100秒 | ~35秒 | ~20秒 | **~10秒** |
| 任务完成体验 | 等待1.5分钟 | 等待35秒 | 等待20秒 | **近乎即时** |
| 数据库压力 | 高 | 中 | 中低 | **低** |

---

## 五、确认清单

请确认优化方向：

### 方案选择
- [ ] **方案A（参数调优）** - 最小改动，立即见效
- [ ] **方案B（并行保存）** - 进一步提速
- [ ] **方案D（结构优化）** - 根本性优化

### 风险确认
- [ ] 减少延迟可能导致MongoDB压力增大（建议先在测试环境验证）
- [ ] 并行保存需要测试最佳并发数
- [ ] 结构优化需要同步修改Excel导出逻辑

### 优先级
- [ ] **优先实施方案A** - 最快见效，风险最低
- [ ] 根据方案A效果决定是否继续实施B/D

---

## 六、快速实施（方案A）

如果您确认，我可以立即修改以下5处代码：

```javascript
// 1. src/server/server.js L24002
- const INSERT_BATCH_SIZE = 3;
+ const INSERT_BATCH_SIZE = 10;

// 2. src/server/server.js L24031
- await new Promise(r => setTimeout(r, 300));
+ await new Promise(r => setTimeout(r, 50));

// 3. src/server/server.js L18725
- const LIGHTWEIGHT_BATCH_SIZE = 5;
+ const LIGHTWEIGHT_BATCH_SIZE = 10;

// 4. src/server/server.js L18775
- await new Promise(resolve => setTimeout(resolve, 500));
+ await new Promise(resolve => setTimeout(resolve, 100));

// 5. src/server/server.js L18843-18862 (进度更新改为每5期)
+ if (savedCount % 5 === 0 || savedCount === periodsToSave.size) {
      // 更新进度逻辑
+ }
```

**预计实施时间**: 15分钟
**预计效果**: 异步保存耗时从100秒降至35秒（65%提升）

---

**请确认是否先实施方案A（参数调优）？**
