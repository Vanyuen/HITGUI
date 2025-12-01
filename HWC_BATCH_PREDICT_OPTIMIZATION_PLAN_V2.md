# 热温冷正选批量预测性能优化方案 V2

## 文档信息
- **创建日期**: 2025-11-28
- **目标**: 将100期批量预测时间从30+分钟降至1-2分钟
- **原则**: 不影响预测结果准确性，保留必要功能

---

## 一、实测性能数据

### 任务 hwc-pos-20251128-9y3（101期）

| 阶段 | 耗时 | 说明 |
|------|------|------|
| 预测结果处理 | **~26秒** | 101条结果全部保存完成 |
| 排除详情保存 | **30+分钟（卡死）** | 0条记录保存成功 |

### 数据量分析

| 指标 | 数值 |
|------|------|
| 单期Step1组合数 | ~47,880 |
| 单期排除总数 | ~43,021 |
| 101期总排除 | ~4,345,121条 |
| 预估数据量 | ~1GB |

### 根本原因
**排除详情保存机制设计不合理**：
- 当前实现为每个被排除的组合保存详细原因
- 101期 × ~43,000排除/期 = ~430万条记录
- 每条记录包含详细JSON → 总数据量~1GB
- 即使并发写入也需数小时

---

## 二、优化方案

### 🔥 核心优化：排除详情智能保存策略

#### 方案描述
根据用户选择，只保存**最近N期+推算期**的排除详情，其他期号仅保存统计摘要。

#### 实现方式

```javascript
// processHwcPositiveTask() 中的修改

// 1. 从任务配置读取排除详情保存选项
const exclusionDetailsSaveConfig = task.output_config?.exclusion_details_save || {
    enabled: true,
    mode: 'recent',      // 'all' | 'recent' | 'none'
    recent_count: 10     // 仅保存最近N期
};

// 2. 确定需要保存排除详情的期号
let periodsToSaveDetails = new Set();
if (exclusionDetailsSaveConfig.enabled && exclusionDetailsSaveConfig.mode !== 'none') {
    if (exclusionDetailsSaveConfig.mode === 'recent') {
        // 只保存最近N期 + 推算期
        const recentCount = exclusionDetailsSaveConfig.recent_count || 10;
        const sortedPeriods = issue_range.sort((a, b) => parseInt(b) - parseInt(a));

        // 最后一期是推算期，始终保存
        periodsToSaveDetails.add(sortedPeriods[0]);

        // 加上最近N期已开奖
        for (let i = 1; i <= recentCount && i < sortedPeriods.length; i++) {
            periodsToSaveDetails.add(sortedPeriods[i]);
        }
    } else if (exclusionDetailsSaveConfig.mode === 'all') {
        // 全部保存（不推荐大规模任务）
        issue_range.forEach(p => periodsToSaveDetails.add(p));
    }
}

// 3. 处理时判断是否保存排除详情
for (const periodResult of result.data) {
    const shouldSaveDetails = periodsToSaveDetails.has(periodResult.target_issue);

    if (shouldSaveDetails && periodResult.exclusions_to_save?.length > 0) {
        // 只对选定的期号保存排除详情
        exclusionSavePromises.push({
            period: periodResult.target_issue,
            saveFn: () => saveExclusionDetailsBatch(...)
        });
    }
}
```

#### 预期效果
| 场景 | 排除详情记录数 | 数据量 | 保存时间 |
|------|---------------|--------|---------|
| 当前（全部保存） | ~430万 | ~1GB | 30+分钟 |
| 优化后（最近10期+推算期） | ~47万 | ~100MB | 1-2分钟 |
| 优化后（仅推算期） | ~4.3万 | ~10MB | 10秒 |

---

### 优化点2：排除详情聚合存储

#### 方案描述
将同一期号同一步骤的排除ID聚合为单条记录，而非逐个保存。

#### 当前 vs 优化后

**当前实现**（逐条保存）：
```json
// 每个被排除的组合一条记录
{ "task_id": "xxx", "period": "25120", "step": 2, "combination_id": 1001, "reason": "..." }
{ "task_id": "xxx", "period": "25120", "step": 2, "combination_id": 1002, "reason": "..." }
... // 4万条
```

**优化后**（聚合保存）：
```json
// 每期每步骤一条记录
{
    "task_id": "xxx",
    "period": "25120",
    "step": 2,
    "condition": "positive_step2_zone_ratio",
    "excluded_count": 40131,
    "excluded_combination_ids": [1001, 1002, ...],  // 数组形式
    "exclusion_summary": {
        "actual_ratio_distribution": { "1:2:2": 5000, "2:1:2": 8000, ... }
    }
}
```

#### 预期效果
- 单期记录数：从~43,000 → 11（每步骤一条）
- 101期记录数：从~430万 → ~1100
- 写入速度提升：1000倍+

---

### 优化点3：异步保存与任务状态分离

#### 方案描述
将排除详情保存改为完全异步，不阻塞任务完成状态更新。

```javascript
// 1. 先更新任务状态为completed
await HwcPositivePredictionTask.updateOne(
    { task_id: taskId },
    {
        $set: {
            status: 'completed',  // 先标记完成
            'progress.percentage': 100,
            completed_at: new Date(),
            exclusion_details_status: 'saving'  // 新字段：排除详情状态
        }
    }
);

// 2. 异步保存排除详情（不阻塞）
setImmediate(async () => {
    try {
        await saveExclusionDetailsForSelectedPeriods(taskId, periodsToSaveDetails, result.data);

        // 更新排除详情状态
        await HwcPositivePredictionTask.updateOne(
            { task_id: taskId },
            { $set: { exclusion_details_status: 'completed' } }
        );
    } catch (error) {
        await HwcPositivePredictionTask.updateOne(
            { task_id: taskId },
            { $set: { exclusion_details_status: 'failed', exclusion_details_error: error.message } }
        );
    }
});

// 3. 立即返回/通知前端任务完成
io.emit('hwc-task-completed', { task_id: taskId, status: 'completed', ... });
```

---

## 三、API响应格式调整

### 任务状态增加字段

```typescript
interface HwcPositivePredictionTask {
    // ... 现有字段 ...

    // 新增：排除详情保存状态
    exclusion_details_status: 'pending' | 'saving' | 'completed' | 'failed' | 'skipped';
    exclusion_details_error?: string;
    exclusion_details_saved_periods?: string[];  // 已保存排除详情的期号列表
}
```

### 前端展示调整

任务完成后显示：
- ✅ 预测完成（主要功能完成）
- ⏳ 排除详情保存中（后台进行）
- ✅ 排除详情保存完成

---

## 四、实施计划

### 阶段1：核心优化（预计1小时）

1. **修改 `processHwcPositiveTask()`**
   - 添加排除详情保存配置读取
   - 实现选择性保存逻辑
   - 任务状态与排除详情保存分离

2. **修改 `saveExclusionDetailsBatch()`**
   - 聚合同一期号同一步骤的排除数据
   - 优化存储格式

### 阶段2：前端适配（可选）

1. 任务创建表单添加排除详情保存选项
2. 任务详情页显示排除详情保存状态

### 阶段3：测试验证

1. 10期任务测试
2. 50期任务测试
3. 100期任务测试
4. 对比优化前后结果一致性

---

## 五、预期效果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| 101期任务完成时间 | 30+分钟 | **1-2分钟** |
| 排除详情保存时间 | 30+分钟 | **1-2分钟**（后台） |
| 任务状态更新 | 卡死 | **立即** |
| 数据库写入量 | ~430万条 | **~1100条** |

---

## 六、确认事项

请确认以下问题：

1. **排除详情保存范围默认值**
   - 建议：最近10期 + 推算期
   - 还是全部保存？

2. **排除详情存储格式**
   - 仅保存排除的组合ID列表
   - 还是需要保留每个组合的详细排除原因？

3. **是否需要前端配置入口**
   - 在任务创建时可选择保存范围
   - 还是使用固定配置？

4. **异步保存是否可接受**
   - 任务完成后，排除详情在后台继续保存
   - 前端可查看保存进度

---

**请确认后我将开始实施。**
