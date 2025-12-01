# 热温冷正选批量预测性能优化方案

## 文档信息
- **创建日期**: 2025-11-27
- **更新日期**: 2025-11-28
- **目标**: 优化100期批量预测的执行时间
- **原则**: 不影响预测结果的准确性

---

## 实际性能数据（2025-11-28实测）

### 任务 hwc-pos-20251128-9y3（101期）
| 阶段 | 耗时 | 说明 |
|------|------|------|
| 预测结果处理 | ~26秒 | 101条结果全部保存完成（01:27:56 → 01:28:22） |
| 排除详情保存 | **30+分钟仍在进行** | 0条记录保存成功，任务卡死 |

### 关键发现
1. **预测本身很快** - 101期只需26秒完成正选+排除+结果保存
2. **排除详情保存是主要瓶颈** - 占用了99%以上的时间
3. **任务状态未更新** - 进度100%但状态仍是processing

### 排除详情数据量分析
| 指标 | 数值 | 说明 |
|------|------|------|
| 单期Step1组合数 | ~47,880 | 热温冷比筛选后 |
| 单期Step2排除 | ~40,131 | 区间比不匹配 |
| 单期Step5排除 | ~2,710 | 奇偶比不匹配 |
| 单期Step6排除 | ~180 | AC值不匹配 |
| **单期总排除** | **~43,021** | 需保存的排除ID数 |
| **101期总排除** | **~4,345,121** | 总记录数 |
| **预估数据量** | **~1GB** | 含详细排除原因 |

### 根本原因
当前实现尝试为每个被排除的组合保存详细原因（`exclusion_details_map`），
导致需要写入超过400万条记录，每条记录还包含JSON详情。
即使使用p-limit(3)控制并发，也需要数小时才能完成。

---

## 一、当前架构分析

### 1.1 核心处理流程

```
创建任务 → processHwcPositiveTask() → HwcPositivePredictor.streamPredict()
                                              ↓
                                       preloadData()  [数据预加载]
                                              ↓
                                       processBatch()  [批次处理，每批50期]
                                              ↓
                        ┌─────────────────────┼─────────────────────┐
                        ↓                     ↓                     ↓
               applyPositiveSelection  applyExclusionConditions  命中分析
                   (6步正选)                (8步排除)         (enableHitAnalysis)
                        ↓                     ↓                     ↓
                  筛选324,632个组合      历史和值/跨度/相克对等      计算中奖统计
                        └─────────────────────┼─────────────────────┘
                                              ↓
                                       保存结果到数据库
                                              ↓
                                       保存排除详情(可选)
```

### 1.2 关键性能数据

| 指标 | 数值 | 说明 |
|------|------|------|
| 红球组合总数 | 324,632 | C(35,5) |
| 蓝球组合总数 | 66 | C(12,2) |
| 配对模式 | truly-unlimited | 笛卡尔积 = 21,425,712 |
| 热温冷优化表 | ~324,632条/期号对 | 按热温冷比分组的组合ID |
| 历史数据 | ~2,800条 | hit_dlts表 |
| 批次大小 | 50期/批 | batchSize |

### 1.3 现有优化措施

1. **全局缓存管理器** (`GlobalCacheManager`)
   - 红球/蓝球组合缓存
   - 历史数据缓存
   - 遗漏值快速索引
   - 特征反向索引

2. **热温冷优化表** (`HIT_DLT_RedCombinationsHotWarmColdOptimized`)
   - 预计算每个期号对的热温冷比分布
   - O(1)查询组合ID

3. **批量处理机制**
   - 分批处理期号（50期/批）
   - 内存监控和GC触发

4. **Worker线程并行化** (已实现但可能未完全启用)
   - filter-worker.js
   - 阈值: 10,000组合

---

## 二、性能瓶颈分析

### 2.1 主要瓶颈点

#### 瓶颈1: 每期独立数据库查询 (高影响)
**位置**: `server.js:16278-16288` (calculateHistoricalStatsForIssue)
**问题**: 每处理一个期号就执行一次数据库查询获取历史统计数据
```javascript
// 当前实现：每期查询一次数据库
const historicalRecords = await hit_dlts.find({
    ID: { $lte: baseID, $gt: baseID - maxPeriod }
}).sort({ ID: -1 }).limit(maxPeriod).lean();
```
**影响**: 100期 × 1次查询 = 100次数据库往返

#### 瓶颈2: 同现比排除的重复计算 (高影响)
**位置**: `server.js:16097-16263` (Exclude 8: 同现比排除)
**问题**: 每期都要重新构建同现特征集合并遍历检查
```javascript
// 每期都要查询历史数据并构建特征集合
const historicalDrawings = await hit_dlts.find({...}).lean();
for (const drawing of historicalDrawings) {
    // 构建2码、3码、4码组合特征
    for (let i = 0; i < balls.length - 1; i++) { ... }
}
```
**影响**: 重复构建特征集合，大量字符串操作

#### 瓶颈3: 排除详情保存 (中等影响)
**位置**: `server.js:18119-18160`
**问题**: 每期的排除详情需要单独保存到数据库
```javascript
// 使用p-limit(3)控制并发，但仍是瓶颈
const results = await Promise.allSettled(
    exclusionSavePromises.map(task => limit(() => task.saveFn()))
);
```
**影响**: 100期 × 多个步骤 = 数百次数据库写入

#### 瓶颈4: 命中分析计算 (中等影响)
**位置**: `server.js:16500-16533`
**问题**: 每期都要计算完整的命中统计
```javascript
if (enableValidation) {
    const hitInfo = await this.calculateHitAnalysisForIssue(
        targetIssue, redCombinations, blueCombinations, combinationMode
    );
}
```
**影响**: 涉及奖项计算、命中分布统计

#### 瓶颈5: 配对组合构建 (中等影响)
**位置**: `server.js:18057-18094`
**问题**: 笛卡尔积模式下构建大量配对对象
```javascript
for (const redCombo of periodResult.red_combinations) {
    for (const blueCombo of periodResult.blue_combinations || []) {
        pairedCombinations.push({...}); // 可能数十万条
    }
}
```
**影响**: 内存分配和对象创建开销

### 2.2 瓶颈权重分析

| 瓶颈 | 每期开销(估计) | 100期总开销 | 优化潜力 |
|------|---------------|------------|---------|
| 历史统计查询 | 50-100ms | 5-10s | 高 (批量预加载) |
| 同现比排除 | 100-200ms | 10-20s | 高 (预计算特征) |
| 排除详情保存 | 200-500ms | 20-50s | 中 (批量写入) |
| 命中分析 | 50-100ms | 5-10s | 中 (并行计算) |
| 配对组合构建 | 100-300ms | 10-30s | 中 (延迟构建) |

---

## 三、优化方案

### 优化点1: 历史统计批量预加载 (预期提速 30-50%)

**目标**: 将N次数据库查询合并为1次

**方案**:
```javascript
// 新增方法: preloadAllHistoricalStats()
async preloadAllHistoricalStats(targetIssues, exclusionConditions) {
    // 1. 找出所有目标期号需要的最大历史范围
    const maxID = Math.max(...targetIssues.map(i => this.issueToIdMap.get(i)));
    const minBaseID = Math.min(...targetIssues.map(i => this.issueToIdMap.get(i) - 1));
    const maxPeriod = this.getMaxHistoricalPeriod(exclusionConditions);

    // 2. 一次性查询所有需要的历史数据
    const allHistoricalRecords = await hit_dlts.find({
        ID: { $gte: minBaseID - maxPeriod, $lte: maxID }
    }).sort({ ID: 1 }).lean();

    // 3. 构建ID→Record索引
    this.historicalRecordsByID = new Map(
        allHistoricalRecords.map(r => [r.ID, r])
    );

    // 4. 预计算每个基准ID的历史统计
    this.historicalStatsCache = new Map();
    for (const targetIssue of targetIssues) {
        const baseID = this.issueToIdMap.get(targetIssue) - 1;
        const stats = this.calculateStatsFromCache(baseID, exclusionConditions);
        this.historicalStatsCache.set(targetIssue, stats);
    }
}
```

**修改位置**:
- `HwcPositivePredictor.preloadData()` - 添加历史统计预加载
- `applyExclusionConditions()` - 使用预加载的统计数据

**预期效果**: 100次查询 → 1次查询，节省5-10秒

---

### 优化点2: 同现特征预计算与索引 (预期提速 20-30%)

**目标**: 避免每期重复构建同现特征集合

**方案**:
```javascript
// 新增方法: preloadCoOccurrenceFeatures()
async preloadCoOccurrenceFeatures(targetIssues, mode, periods) {
    // 1. 确定需要分析的期号范围
    const maxBaseID = Math.max(...targetIssues.map(i => this.issueToIdMap.get(i) - 1));
    const minBaseID = Math.min(...targetIssues.map(i => this.issueToIdMap.get(i) - 1)) - periods;

    // 2. 一次性查询所有需要的开奖数据
    const drawings = await hit_dlts.find({
        ID: { $gte: minBaseID, $lte: maxBaseID }
    }).select('Issue ID Red1 Red2 Red3 Red4 Red5').lean();

    // 3. 为每个目标期号预计算排除特征集合
    this.coOccurrenceFeaturesCache = new Map();
    for (const targetIssue of targetIssues) {
        const baseID = this.issueToIdMap.get(targetIssue) - 1;
        const relevantDrawings = drawings.filter(d =>
            d.ID <= baseID && d.ID > baseID - periods
        );
        const features = this.buildCoOccurrenceFeatures(relevantDrawings, mode);
        this.coOccurrenceFeaturesCache.set(targetIssue, features);
    }
}

// 优化: 使用Set而非字符串数组
buildCoOccurrenceFeatures(drawings, mode) {
    const features = new Set();
    for (const drawing of drawings) {
        const balls = [drawing.Red1, drawing.Red2, drawing.Red3, drawing.Red4, drawing.Red5];
        // ... 构建特征
    }
    return features;
}
```

**修改位置**:
- `HwcPositivePredictor.preloadData()` - 添加同现特征预加载
- `applyExclusionConditions()` 中的同现比排除 - 使用预计算特征

**预期效果**: 减少重复计算，节省10-20秒

---

### 优化点3: 排除详情批量写入 (预期提速 15-25%)

**目标**: 将多次小批量写入合并为少量大批量写入

**方案**:
```javascript
// 修改保存逻辑: 收集所有排除详情后一次性写入
async function saveAllExclusionDetails(taskId, allResults) {
    const allDocuments = [];

    for (const periodResult of allResults) {
        for (const exclusion of periodResult.exclusions_to_save || []) {
            allDocuments.push({
                task_id: taskId,
                result_id: `${taskId}-${periodResult.target_issue}`,
                period: periodResult.target_issue,
                step: exclusion.step,
                condition: exclusion.condition,
                excluded_combination_ids: exclusion.excludedIds,
                exclusion_details_map: exclusion.detailsMap,
                // ... 其他字段
            });
        }
    }

    // 使用bulkWrite批量写入
    if (allDocuments.length > 0) {
        const BATCH_SIZE = 1000;
        for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
            const batch = allDocuments.slice(i, i + BATCH_SIZE);
            await DLTExclusionDetails.insertMany(batch, { ordered: false });
        }
    }
}
```

**修改位置**:
- `processHwcPositiveTask()` - 移除逐期保存，改为任务完成后批量保存

**预期效果**: 数百次写入 → 数次批量写入，节省15-30秒

---

### 优化点4: 任务结果批量保存 (预期提速 10-15%)

**目标**: 将任务结果的保存也改为批量操作

**方案**:
```javascript
// 收集所有期号结果后批量写入
async function saveAllTaskResults(taskId, allResults) {
    const documents = allResults.map(periodResult => ({
        result_id: `${taskId}-${periodResult.target_issue}`,
        task_id: taskId,
        period: periodResult.target_issue,
        // ... 其他字段
    }));

    // 批量写入
    await HwcPositivePredictionTaskResult.insertMany(documents, { ordered: false });
}
```

**修改位置**:
- `processHwcPositiveTask()` - 改为批量保存结果

**预期效果**: 100次写入 → 1次批量写入

---

### 优化点5: 配对组合延迟构建 (预期提速 5-10%)

**目标**: 仅在需要时才构建完整的配对组合数组

**方案**:
```javascript
// 不在内存中构建完整的pairedCombinations数组
// 而是保存红球和蓝球组合ID，需要时再计算

// 保存结果时只保存ID列表
await HwcPositivePredictionTaskResult.create({
    red_combinations: periodResult.red_combinations.map(c => c.combination_id),
    blue_combinations: (periodResult.blue_combinations || []).map(c => c.combination_id),
    // paired_combinations: 移除，改为需要时动态生成
    pairing_mode: pairingMode,
    // ...
});

// 需要导出Excel时再构建配对
function buildPairedCombinationsOnDemand(redIds, blueIds, mode) {
    // 动态构建
}
```

**修改位置**:
- `processHwcPositiveTask()` - 移除内存中构建pairedCombinations
- 添加按需构建函数

**预期效果**: 减少内存使用和对象创建开销

---

### 优化点6: 批量命中分析 (预期提速 5-10%)

**目标**: 利用已有的批量验证框架

**方案**:
利用现有的 `performBatchHitValidation()` 方法，在批次处理完成后统一进行命中验证，而不是逐期验证。

```javascript
// 在processBatch完成后，批量进行命中分析
async processBatch(issuesBatch, ...) {
    const batchResults = [];

    // 1. 先完成所有期号的正选和排除
    for (const targetIssue of issuesBatch) {
        // ... 正选和排除逻辑
        batchResults.push({
            target_issue: targetIssue,
            red_combinations: redCombinations,
            blue_combinations: blueCombinations,
            // hitAnalysis: null  // 稍后批量计算
        });
    }

    // 2. 批量计算命中分析
    if (enableValidation) {
        const hitAnalysisMap = await this.performBatchHitValidation(...);
        for (const result of batchResults) {
            const hitInfo = hitAnalysisMap.get(result.target_issue);
            result.hit_analysis = hitInfo?.hitAnalysis;
            result.is_predicted = hitInfo?.isPredicted ?? true;
        }
    }

    return batchResults;
}
```

**修改位置**:
- `HwcPositivePredictor.processBatch()` - 使用批量命中验证

---

## 四、实施计划

### 阶段1: 高优先级优化 (预期提速 50-80%)

| 序号 | 优化项 | 预期提速 | 复杂度 | 风险 |
|------|--------|---------|-------|------|
| 1 | 历史统计批量预加载 | 30-50% | 中 | 低 |
| 2 | 同现特征预计算 | 20-30% | 中 | 低 |

### 阶段2: 中优先级优化 (预期额外提速 20-40%)

| 序号 | 优化项 | 预期提速 | 复杂度 | 风险 |
|------|--------|---------|-------|------|
| 3 | 排除详情批量写入 | 15-25% | 低 | 低 |
| 4 | 任务结果批量保存 | 10-15% | 低 | 低 |

### 阶段3: 低优先级优化 (预期额外提速 10-20%)

| 序号 | 优化项 | 预期提速 | 复杂度 | 风险 |
|------|--------|---------|-------|------|
| 5 | 配对组合延迟构建 | 5-10% | 低 | 中 |
| 6 | 批量命中分析 | 5-10% | 中 | 低 |

---

## 五、预期效果

### 5.1 时间估算

| 场景 | 当前时间(估计) | 优化后(估计) | 提速比例 |
|------|---------------|-------------|---------|
| 100期(无命中分析) | 60-90秒 | 20-35秒 | 60-70% |
| 100期(有命中分析) | 90-120秒 | 30-50秒 | 55-65% |
| 500期(无命中分析) | 300-450秒 | 100-175秒 | 60-70% |

### 5.2 资源使用

| 指标 | 当前 | 优化后 | 变化 |
|------|------|-------|------|
| 数据库查询次数 | N+常量 | 常量 | 大幅减少 |
| 内存峰值 | 高 | 中等 | 略微增加(预加载) |
| CPU使用率 | 中等 | 中等 | 基本不变 |

---

## 六、风险评估

### 6.1 低风险

- **数据一致性**: 所有优化都是查询/存储层面的，不涉及业务逻辑修改
- **结果准确性**: 筛选和排除逻辑不变，只是执行顺序和批量化

### 6.2 需要注意

- **内存使用**: 批量预加载会增加内存使用，但在32GB环境下可接受
- **错误处理**: 批量操作失败时需要有适当的回滚或重试机制

---

## 七、测试计划

### 7.1 功能测试

1. **正选结果对比**: 对比优化前后相同配置的正选结果
2. **排除结果对比**: 对比优化前后相同配置的排除结果
3. **命中分析对比**: 对比优化前后的命中统计

### 7.2 性能测试

1. **10期测试**: 验证基本功能和小规模性能
2. **50期测试**: 验证中等规模性能
3. **100期测试**: 验证目标场景性能
4. **500期测试**: 验证大规模场景稳定性

### 7.3 回归测试

1. 确保现有API接口行为不变
2. 确保前端展示正常
3. 确保导出Excel功能正常

---

## 八、待确认事项

请确认以下问题后再开始实施：

1. **当前100期预测的实际耗时是多少？**
   - 这将帮助更准确地评估优化效果

2. **是否需要保留排除详情保存功能？**
   - 如果不需要，可以完全跳过，大幅提升性能

3. **命中分析是否必须？**
   - 如果对于未开奖期不需要，可以进一步优化

4. **是否可以接受内存使用增加约20-30%？**
   - 预加载会占用更多内存

5. **是否需要保持API响应格式完全一致？**
   - 某些优化可能需要微调响应结构

---

## 九、总结

本优化方案通过以下核心策略提升性能：

1. **减少数据库往返** - 批量预加载替代逐次查询
2. **消除重复计算** - 预计算可复用的数据结构
3. **批量写入** - 合并多次小写入为大批量写入
4. **延迟计算** - 按需生成数据而非预先构建

预期可将100期批量预测时间从当前的60-120秒降低到20-50秒，提速约60%。

---

**请审阅此方案，确认后我将按阶段开始实施。**
