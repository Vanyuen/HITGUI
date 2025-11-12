# 热温冷正选批量预测任务导出功能与数据结构完整分析

## 一、导出API端点

### 主导出API
**路径**: `E:\HITGUI\src\server\server.js` 第20001行

```
GET /api/dlt/hwc-positive-tasks/:task_id/period/:period/export
```

#### 功能说明
- 为热温冷正选任务的指定期号生成Excel文件
- 支持新旧两种数据格式（向后兼容）
- 包含3个工作表：预测组合、红球排除详情、排除统计

#### 关键参数
- `task_id`: 任务ID (例: hwc-pos-20251111-001)
- `period`: 期号 (例: 25121)

#### 返回格式
- **Content-Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- **文件名编码**: RFC 5987标准（同时支持ASCII fallback和UTF-8编码）
- 直接流式下载

---

## 二、数据库数据结构

### 1. HwcPositivePredictionTask（任务表）
**Model**: `HwcPositivePredictionTask`
**Collection**: `HIT_DLT_HwcPositivePredictionTask`

#### 关键Schema字段（简化版）
- task_id: String（唯一）
- task_name: String
- period_range: { type, start, end, total, predicted_count }
- positive_selection: 6步正选条件配置
- exclusion_conditions: 排除条件配置
  - sum/span/hwc/zone: 历史排除
  - conflictPairs: 相克对排除
  - coOccurrence: 同现比排除
  - consecutiveGroups/maxConsecutiveLength: 连号排除
  - pairing_mode: 'default'|'unlimited'|'truly-unlimited'

### 2. HwcPositivePredictionTaskResult（结果表）
**Model**: `HwcPositivePredictionTaskResult`
**Collection**: `HIT_DLT_HwcPositivePredictionTaskResult`

#### 关键字段
- result_id: String（唯一）
- task_id: String
- period: Number
- combination_count: Number（最终保留数）
- paired_combinations: [{red_combo_id, red_balls, blue_combo_id, blue_balls, zone_ratio, sum_value, span_value, odd_even_ratio}]
- pairing_mode: String
- hit_analysis: {max_red_hit, max_blue_hit, prize_stats, total_prize}（仅已开奖期）
- exclusion_summary: {positive_selection_count, sum_exclude_count, ..., final_count}
- positive_selection_details: {step1_base_combination_ids, step2-6_retained_count}（Step追踪）

### 3. HIT_DLT_ExclusionDetails（排除详情表）
**Model**: `DLTExclusionDetails`
**Collection**: `HIT_DLT_ExclusionDetails`

#### 关键字段
- task_id: String（索引）
- result_id: String（索引）
- period: String（索引）
- step: Number（排除步骤）
- condition: String（排除条件类型）
- excluded_combination_ids: Number[]（被排除的组合ID）
- excluded_count: Number（排除数量）
- is_partial: Boolean（分片标记）
- chunk_index/total_chunks: Number（分片信息）

#### 排除条件类型编码表

| condition值 | 含义 | step | 说明 |
|-----------|------|------|------|
| positive_step2_zone_ratio | 区间比正选 | 2 | Step 2筛选 |
| positive_step3_sum_range | 和值范围正选 | 3 | Step 3筛选 |
| positive_step4_span_range | 跨度范围正选 | 4 | Step 4筛选 |
| positive_step5_odd_even_ratio | 奇偶比正选 | 5 | Step 5筛选 |
| positive_step6_ac_value | AC值正选 | 6 | Step 6筛选 |

---

## 三、Excel导出的3个工作表

### Sheet 1: 预测组合表（已实现）
**颜色**: 蓝色表头 (#FF4472C4)

#### 列结构
| 列 | 说明 |
|----|------|
| 序号 | 行序号 |
| 红球1-5 | 红球号码（补0） |
| 蓝球1-2 | 蓝球号码（补0） |
| 和值 | sum_value |
| 跨度 | span_value |
| 区间比 | zone_ratio |
| 奇偶比 | odd_even_ratio |
| 热温冷比 | hwc_ratio |
| AC值 | ac_value |
| 连号组数 | consecutive_groups |
| 最长连号 | max_consecutive_length |
| **仅已开奖期** | |
| 红球命中 | redHit（计算） |
| 蓝球命中 | blueHit（计算） |
| 中奖等级 | judgePrize(redHit,blueHit) |
| 奖金 | getPrizeAmount(prizeLevel) |

### Sheet 2: 红球排除详情表（骨架已创建，数据待实现）
**颜色**: 橙色表头 (#FFFF9800)
**当前状态**: TODO - 需要重新执行排除逻辑查询被排除的组合

#### 列结构
| 列 | 说明 |
|----|------|
| 红球1-5 | 被排除的组合号码 |
| 和值/跨度/区间比/奇偶比/热温冷比/AC值 | 组合特征 |
| 连号情况 | 连号信息 |
| 排除原因 | 被排除的条件说明 |

**实现思路**:
1. 查询所有排除记录: `DLTExclusionDetails.find({task_id, period})`
2. 合并分片数据获取完整排除ID列表
3. 查询组合特征: `DLTRedCombinations.findOne({combination_id})`
4. 映射condition到人类可读描述
5. 填充到Sheet 2

### Sheet 3: 排除统计表（已实现）
**颜色**: 蓝色表头 (#FF2196F3)

#### 列结构
| 列 | 说明 |
|----|------|
| 排除条件 | 条件名称 |
| 排除组合数 | exclusion_summary[field] |
| 排除百分比 | (count/baseCount)*100% |

#### 数据来源
从 `periodResult.exclusion_summary` 获取：
- positive_selection_count（基础）
- sum/span/hwc/zone_exclude_count（历史排除）
- conflict_exclude_count（相克对）
- cooccurrence_exclude_count（同现比）
- consecutive_groups/max_consecutive_length_exclude_count（连号排除）
- final_count（最终保留）

---

## 四、排除条件详细说明

### A. 正选条件（6步筛选流程）

```
Step 1: 热温冷比 → 获取符合hwc_ratios的组合ID集合
  ↓
Step 2: 区间比 → filter(zone_ratio in positive_selection.zone_ratios)
  ↓ 记录排除详情: condition='positive_step2_zone_ratio', step=2
  ↓
Step 3: 和值范围 → filter(sum in ranges)
  ↓ 记录排除详情: condition='positive_step3_sum_range', step=3
  ↓
Step 4: 跨度范围 → filter(span in ranges)
  ↓ 记录排除详情: condition='positive_step4_span_range', step=4
  ↓
Step 5: 奇偶比 → filter(odd_even_ratio in positive_selection.odd_even_ratios)
  ↓ 记录排除详情: condition='positive_step5_odd_even_ratio', step=5
  ↓
Step 6: AC值 → filter(ac_value in positive_selection.ac_values)
  ↓ 记录排除详情: condition='positive_step6_ac_value', step=6
  ↓
最终红蓝配对
```

### B. 排除条件（可选）

#### 连号排除（已实现框架）
- **consecutiveGroups**: 排除指定连号组数 (0-4)
  - 例: [0,3,4] 排除0组、3组、4组连号的组合
- **maxConsecutiveLength**: 排除指定最长连号长度 (0-5)
  - 例: [5] 排除最长连号为5的组合

#### 相克对排除（框架存在，逻辑待实现）
```javascript
conflictPairs: {
    enabled: Boolean,
    globalTop: { enabled, period, top, hotProtect:{enabled, top} },
    perBallTop: { enabled, period, top, hotProtect:{...} },
    threshold: { enabled, value, hotProtect:{...} }
}
```

#### 同现比排除（框架存在，逻辑待实现）
```javascript
coOccurrence: {
    enabled: Boolean,
    threshold: { enabled, value },
    historical: { enabled, period, combo2, combo3, combo4 }
}
```

#### 历史排除条件（框架存在，逻辑待实现）
- **sum**: 排除最近N期出现的和值
- **span**: 排除最近N期出现的跨度
- **hwc**: 排除最近N期出现的热温冷比
- **zone**: 排除最近N期出现的区间比

---

## 五、排除详情保存与查询

### 保存函数
**位置**: `E:\HITGUI\src\server\server.js:20642`

```javascript
async function saveExclusionDetails(task_id, result_id, period, step, condition, excludedIds)
```

**特性**:
- 支持大数据量：按50000条ID分片存储
- 分片数据包含 `is_partial=true, chunk_index, total_chunks`
- 查询时自动合并分片

**调用位置**: 
- `E:\HITGUI\src\server\server.js:21246-21260`（异步后台保存，不阻塞任务）

### 排除详情查询API

#### 1. 获取任务的所有排除详情
```
GET /api/dlt/exclusion-details/:taskId?period=xxx&step=xxx&condition=xxx
```
**实现**: 第16735行，支持多条件查询和分片合并

#### 2. 查询组合被哪些条件排除
```
GET /api/dlt/exclusion-details/combination/:combinationId?taskId=xxx&period=xxx
```
**实现**: 第16791行，反向查询

#### 3. 查询排除分析
```
GET /api/dlt/exclusion-details/analysis/:taskId
```
**实现**: 第16824行

#### 4. 查询组合排除路径
```
GET /api/dlt/hwc-positive-tasks/:task_id/period/:period/combination/:combo_id/exclusion-path
```
**实现**: 第20428行，查询组合在哪一步被排除

---

## 六、中奖规则与计算

### 大乐透（DLT）中奖规则

| 等级 | 红球 | 蓝球 | 奖金 |
|-----|------|------|------|
| 一等奖 | 5 | 2 | 1000万 |
| 二等奖 | 5 | 1 | 50万 |
| 三等奖 | 5 | 0 | 1万 |
| 四等奖 | 4 | 2 | 3000元 |
| 五等奖 | 4 | 1 | 300元 |
| 六等奖 | 3 | 2 | 200元 |
| 七等奖 | 4 | 0 | 100元 |
| 八等奖 | 3\|2 | 1\|2 | 15元 |
| 九等奖 | 3\|1\|2\|0 | + 2蓝 | 5元 |

**实现位置**: `E:\HITGUI\src\server\server.js:20140-20172`

```javascript
function judgePrize(redHit, blueHit)    // 判断等级
function getPrizeAmount(prizeName)      // 获取奖金
```

---

## 七、配对模式

### 1. Default（默认）- 1:1循环
```
N个红球 × 66个蓝球 → N个配对（蓝球循环匹配）
例: blueIndex = redIndex % 66
```

### 2. Unlimited（普通无限制）
```
等同于Default模式
```

### 3. Truly-Unlimited（真·无限制）- 笛卡尔积
```
N个红球 × 66个蓝球 → N×66个配对（所有组合）
```

---

## 八、关键代码位置

| 功能 | 文件 | 行号 |
|-----|------|------|
| 导出API主函数 | server.js | 20001-20422 |
| 排除详情保存函数 | server.js | 20642-20687 |
| 任务处理函数 | server.js | 20692+ |
| 正选筛选逻辑 | server.js | 20770-20945 |
| 排除条件处理 | server.js | 20947-21024 |
| 配对逻辑 | server.js | 21026-21052 |
| Task Schema | server.js | 1048-1240 |
| Result Schema | server.js | 1247-1346 |
| ExclusionDetails Schema | server.js | 1017-1045 |
| 排除查询API | server.js | 16735-16785 |
| 排除路径API | server.js | 20428-20500 |

---

## 九、待实现功能优先级

### 高优先级
1. **Sheet 2数据填充** - 获取被排除的组合及排除原因
2. **历史排除条件** - sum/span/hwc/zone排除逻辑
3. **相克对排除** - globalTop/perBallTop/threshold策略
4. **同现比排除** - threshold和historical过滤

### 中优先级
1. **排除详情Sheet增强** - 多条件分组/排序
2. **前端排除查询UI** - 可视化排除漏斗
3. **性能监控** - 处理时间和内存统计

---

## 十、现状总结

### 已实现
- 导出API完整实现（Sheet 1、Sheet 3）
- 排除详情数据库结构和保存机制
- 排除查询API（支持分片合并）
- 6步正选筛选框架
- 连号排除框架
- 数据一致性验证

### 缺口
- Sheet 2的排除详情数据填充
- 历史排除条件的执行逻辑
- 相克对排除完整实现
- 同现比排除完整实现
- 前端排除过程可视化

