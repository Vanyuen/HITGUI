# HIT-大乐透-热温冷正选批量预测功能 - 正选条件筛选全流程

## 📋 文档说明

**文档目的**: 详细阐述热温冷正选批量预测功能中正选条件筛选的完整流程
**适用版本**: HIT数据分析系统 v1.0+
**最后更新**: 2025-11-02
**核心特性**: 6步正选筛选 + 5步排除条件 + 多模式红蓝配对

---

## 🎯 功能概述

**热温冷正选批量预测**是一种基于历史遗漏值分析的彩票号码筛选方法，通过6个递进式正选步骤，从324,632个红球组合中精准筛选出符合条件的组合，再与蓝球配对形成完整投注方案。

**核心优势**:
- ✅ **数据驱动**: 基于热温冷优化表（99.7%性能提升）
- ✅ **6步渐进**: 层层筛选，从粗到细，逐步精准
- ✅ **灵活配置**: 每步支持多选、范围选择、快捷预设
- ✅ **实时反馈**: UI显示每步筛选后的组合数估算
- ✅ **智能推荐**: 基于历史数据分布的默认推荐值

---

## 📊 数据基础

### 1. 红球组合表 (DLTRedCombinations)

**记录数**: 324,632条 (C(35,5) = 35选5的所有组合)

**核心字段**:
```javascript
{
    combination_id: Number,        // 组合ID (1-324632)
    red_ball_1: Number,            // 红球1 (1-35)
    red_ball_2: Number,            // 红球2
    red_ball_3: Number,            // 红球3
    red_ball_4: Number,            // 红球4
    red_ball_5: Number,            // 红球5

    // 预计算特征 (正选筛选依据)
    sum_value: Number,             // 和值 (15-165)
    span_value: Number,            // 跨度 (4-34)
    zone_ratio: String,            // 区间比 (如 "2:2:1")
    odd_even_ratio: String,        // 奇偶比 (如 "3:2")
    ac_value: Number,              // AC值 (0-6)
    consecutive_groups: Number,    // 连号组数 (0-4)
    max_consecutive_length: Number // 最长连号长度 (0-5)
}
```

### 2. 热温冷优化表 (DLTRedCombinationsHotWarmColdOptimized)

**用途**: 预计算每个期号对的热温冷比分布，避免实时计算

**数据结构**:
```javascript
{
    base_issue: String,           // 基准期号 (如 "25115")
    target_issue: String,         // 目标期号 (如 "25116")
    hot_warm_cold_data: {
        "5:0:0": [1, 23, 456, ...],  // 5热0温0冷的组合ID列表
        "4:1:0": [12, 34, 567, ...], // 4热1温0冷
        "3:2:0": [45, 78, 890, ...], // 3热2温0冷
        // ... 所有35种热温冷比
    }
}
```

**热温冷定义**:
- **热球 (Hot)**: 遗漏值 ≤ 4期
- **温球 (Warm)**: 遗漏值 5-9期
- **冷球 (Cold)**: 遗漏值 ≥ 10期

---

## 🔥 正选条件筛选 - 完整6步流程

### 🎯 总体流程图

```
初始组合池: 324,632个
    ↓
Step 1: 热温冷比筛选 → ~150,000-220,000 (46%-68%)
    ↓
Step 2: 区间比筛选 → ~100,000-150,000 (31%-46%)
    ↓
Step 3: 和值范围筛选 → ~80,000-120,000 (25%-37%)
    ↓
Step 4: 跨度范围筛选 → ~50,000-80,000 (15%-25%)
    ↓
Step 5: 奇偶比筛选 → ~30,000-50,000 (9%-15%)
    ↓
Step 6: AC值筛选 → ~20,000-40,000 (6%-12%)
    ↓
最终正选组合 (压缩率 ~90-95%)
```

---

### Step 1: 热温冷比筛选 (核心第一步)

**位置**: `src/server/server.js` lines 18562-18571
**前端UI**: `src/renderer/index.html` lines 2673-2723

#### 🔍 筛选原理

基于**基准期→目标期**的期号对，从热温冷优化表中获取候选组合ID。

**示例**:
```
基准期: 25115
目标期: 25116

从优化表获取: base_issue=25115, target_issue=25116
选择热温冷比: 2:2:1, 2:1:2, 1:2:2 (用户勾选)

结果: 从优化表的 hot_warm_cold_data 中取出对应比例的所有组合ID
     candidateIds = Set(hwcData["2:2:1"] + hwcData["2:1:2"] + hwcData["1:2:2"])
```

#### 📋 可选的35种热温冷比

**分类1: 极端比例 (9种)** - 单一类型占绝对多数
```
5:0:0 (全热), 0:5:0 (全温), 0:0:5 (全冷)
4:1:0, 4:0:1, 1:4:0, 0:4:1, 1:0:4, 0:1:4
```

**分类2: 高倾向比例 (14种)** - 某一类型占主导(3-4个)
```
3:2:0, 3:1:1, 3:0:2, 2:3:0, 2:0:3
1:3:1, 1:1:3, 0:3:2, 1:0:4, 0:1:4 等
```

**分类3: 平衡比例 (12种) ⭐推荐** - 各类型相对均衡
```
2:2:1 ⭐, 2:1:2 ⭐, 1:2:2 ⭐ (最常见)
3:1:1, 1:3:1, 2:3:0, 2:0:3, 0:2:3, 0:3:2 等
```

#### 🎨 前端UI配置

**默认选中**: 8种平衡比例 (2:2:1, 2:1:2, 1:2:2, 3:2:0, 3:1:1, 2:3:0, 1:3:1, 1:2:2)

**快捷预设按钮**:
```html
<button onclick="selectHwcPosPreset('hot')">热球倾向 (9种)</button>
<button onclick="selectHwcPosPreset('cold')">冷球倾向 (9种)</button>
<button onclick="selectHwcPosPreset('balanced')">平衡比例 (12种) ⭐</button>
<button onclick="selectHwcPosPreset('all')">全选35种</button>
```

#### 💻 后端处理逻辑

**代码位置**: `src/server/server.js:18562-18571`

```javascript
// Step 1: 从热温冷优化表获取基础数据
const hwcRecord = await DLTRedCombinationsHotWarmColdOptimized.findOne({
    base_issue: baseIssue,
    target_issue: targetIssue
}).lean();

if (!hwcRecord) {
    log(`⚠️ 未找到期号对 ${baseIssue}->${targetIssue} 的热温冷数据，跳过`);
    continue;
}

// Step 2: 热温冷比筛选
let candidateIds = new Set();
const hwcData = hwcRecord.hot_warm_cold_data || {};

(positive_selection.hwc_ratios || []).forEach(ratio => {
    const ids = hwcData[ratio] || [];
    ids.forEach(id => candidateIds.add(id));
});

log(`  Step 1 - 热温冷比筛选: ${candidateIds.size} 个组合`);
```

**日志输出示例**:
```
🔄 处理期号对: 25115 -> 25116 (1/1)
  Step 1 - 热温冷比筛选: 185,423 个组合
```

---

### Step 2: 区间比筛选

**位置**: `src/server/server.js` lines 18592-18598
**前端UI**: `src/renderer/index.html` lines 2735-2825

#### 🔍 筛选原理

将红球号码分为三个区间，统计每个区间的号码数量，形成区间比。

**区间划分**:
- **一区**: 1-12 (共12个号)
- **二区**: 13-24 (共12个号)
- **三区**: 25-35 (共11个号)

**示例**:
```
组合: 2-15-18-27-33

一区(1-12):   2                → 1个
二区(13-24):  15, 18           → 2个
三区(25-35):  27, 33           → 2个

区间比: 1:2:2
```

#### 📋 可选的21种区间比

**分类1: 极端比例 (3种)**
```
5:0:0 (全一区), 0:5:0 (全二区), 0:0:5 (全三区)
```

**分类2: 高倾向比例 (6种)**
```
4:1:0, 4:0:1, 1:4:0, 0:4:1, 1:0:4, 0:1:4
```

**分类3: 平衡比例 (12种) ⭐推荐**
```
2:2:1 ⭐, 2:1:2 ⭐, 1:2:2 ⭐ (最常见)
3:1:1, 3:0:2, 2:3:0, 2:0:3, 1:3:1, 1:1:3, 0:3:2, 0:2:3
```

#### 💻 后端处理逻辑

```javascript
// Step 2: 区间比筛选
if (positive_selection.zone_ratios && positive_selection.zone_ratios.length > 0) {
    const beforeCount = combinations.length;
    combinations = combinations.filter(combo =>
        positive_selection.zone_ratios.includes(combo.zone_ratio)
    );
    log(`  Step 2 - 区间比筛选: ${beforeCount} -> ${combinations.length} 个组合 (条件: ${positive_selection.zone_ratios.join(', ')})`);
}
```

**日志输出示例**:
```
  Step 2 - 区间比筛选: 185,423 -> 123,567 个组合 (条件: 2:2:1, 2:1:2, 1:2:2)
```

---

### Step 3: 和值范围筛选

**位置**: `src/server/server.js` lines 18600-18610
**前端UI**: `src/renderer/index.html` lines 2836-2929

#### 🔍 筛选原理

**和值** = 5个红球号码之和

**理论范围**: 15 (1+2+3+4+5) - 165 (31+32+33+34+35)
**常用范围**: 60-120 (约覆盖80%的组合)

**示例**:
```
组合: 5-12-18-25-32
和值 = 5+12+18+25+32 = 92
```

#### 📋 和值范围配置

**支持最多3个不连续范围**:

**范围1** (必选): 默认 65-90 (偏小和值)
**范围2** (必选): 默认 91-115 (中等和值)
**范围3** (可选): 自定义

**快捷预设**:
```javascript
小和值:  40-80   (偏冷门)
中和值:  80-110  (常见)
大和值:  110-145 (偏冷门)
平衡:    65-115  (覆盖主流)
全部:    15-165  (不筛选)
```

#### 💻 后端处理逻辑

```javascript
// Step 3: 和值范围筛选
if (positive_selection.sum_ranges && positive_selection.sum_ranges.length > 0) {
    const beforeCount = combinations.length;
    combinations = combinations.filter(combo => {
        return positive_selection.sum_ranges.some(range =>
            combo.sum_value >= range.min && combo.sum_value <= range.max
        );
    });
    const rangeStr = positive_selection.sum_ranges.map(r => `${r.min}-${r.max}`).join(', ');
    log(`  Step 3 - 和值范围筛选: ${beforeCount} -> ${combinations.length} 个组合 (条件: ${rangeStr})`);
}
```

**日志输出示例**:
```
  Step 3 - 和值范围筛选: 123,567 -> 98,432 个组合 (条件: 65-90, 91-115)
```

**前端数据结构**:
```javascript
positive_selection: {
    sum_ranges: [
        { min: 65, max: 90 },   // 范围1
        { min: 91, max: 115 }   // 范围2
    ]
}
```

---

### Step 4: 跨度范围筛选

**位置**: `src/server/server.js` lines 18612-18622
**前端UI**: `src/renderer/index.html` lines 2933-2995

#### 🔍 筛选原理

**跨度** = 最大号码 - 最小号码

**理论范围**: 4 (如1-2-3-4-5) - 34 (如1-35)
**常用范围**: 18-32 (约覆盖75%的组合)

**示例**:
```
组合: 3-8-15-22-31
跨度 = 31 - 3 = 28
```

#### 📋 跨度范围配置

**支持最多3个不连续范围**:

**范围1** (默认启用): 18-25 (中等偏小跨度)
**范围2** (默认启用): 26-32 (中等偏大跨度)
**范围3** (可选): 自定义

**快捷预设**:
```javascript
小跨度:  10-20  (号码集中)
中跨度:  21-28  (常见)
大跨度:  29-34  (号码分散)
平衡:    15-30  (覆盖主流)
全部:    4-34   (不筛选)
```

#### 💻 后端处理逻辑

```javascript
// Step 4: 跨度范围筛选
if (positive_selection.span_ranges && positive_selection.span_ranges.length > 0) {
    const beforeCount = combinations.length;
    combinations = combinations.filter(combo => {
        return positive_selection.span_ranges.some(range =>
            combo.span_value >= range.min && combo.span_value <= range.max
        );
    });
    const rangeStr = positive_selection.span_ranges.map(r => `${r.min}-${r.max}`).join(', ');
    log(`  Step 4 - 跨度范围筛选: ${beforeCount} -> ${combinations.length} 个组合 (条件: ${rangeStr})`);
}
```

**日志输出示例**:
```
  Step 4 - 跨度范围筛选: 98,432 -> 67,890 个组合 (条件: 18-25, 26-32)
```

---

### Step 5: 奇偶比筛选

**位置**: `src/server/server.js` lines 18624-18631
**前端UI**: `src/renderer/index.html` lines 2998-3049

#### 🔍 筛选原理

统计5个红球中奇数和偶数的数量，形成奇偶比。

**奇数**: 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35 (共18个)
**偶数**: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34 (共17个)

**示例**:
```
组合: 3-8-15-22-31

奇数: 3, 15, 31  → 3个
偶数: 8, 22      → 2个

奇偶比: 3:2
```

#### 📋 可选的6种奇偶比

```
0:5 (全偶) - 极少见
1:4        - 较少见
2:3 ⭐     - 常见，推荐
3:2 ⭐     - 常见，推荐
4:1        - 较少见
5:0 (全奇) - 极少见
```

**默认选中**: 2:3, 3:2 (约占60%的组合)

#### 💻 后端处理逻辑

```javascript
// Step 5: 奇偶比筛选
if (positive_selection.odd_even_ratios && positive_selection.odd_even_ratios.length > 0) {
    const beforeCount = combinations.length;
    combinations = combinations.filter(combo =>
        positive_selection.odd_even_ratios.includes(combo.odd_even_ratio)
    );
    log(`  Step 5 - 奇偶比筛选: ${beforeCount} -> ${combinations.length} 个组合 (条件: ${positive_selection.odd_even_ratios.join(', ')})`);
}
```

**日志输出示例**:
```
  Step 5 - 奇偶比筛选: 67,890 -> 42,345 个组合 (条件: 2:3, 3:2)
```

---

### Step 6: AC值筛选 (算术复杂度)

**位置**: `src/server/server.js` lines 18633-18640
**前端UI**: `src/renderer/index.html` lines 3051-3110

#### 🔍 筛选原理

**AC值 (Arithmetic Complexity)** 衡量号码组合的离散程度。

**计算公式**:
```
AC值 = 不重复差值数量 - (n-1)
其中 n = 5 (红球数量)
```

**计算步骤**:
1. 计算5个号码中任意两个号码的差值
2. 对差值去重
3. 差值数量 - 4 = AC值

**范围**: 0-6
- **AC=0**: 极度集中（如连号 1-2-3-4-5）
- **AC=6**: 高度分散（如 1-8-15-25-35）

**示例1: 连号组合**
```
组合: 1-2-3-4-5
差值: 1,2,3,4 (最小差), 2,3,4 (次小差), ... ,4 (最大差)
去重差值: {1,2,3,4} → 4个
AC值 = 4 - 4 = 0
```

**示例2: 分散组合**
```
组合: 1-8-15-25-35
差值: 7(8-1), 14(15-1), 24(25-1), 34(35-1)
      7(15-8), 17(25-8), 27(35-8)
      10(25-15), 20(35-15)
      10(35-25)
去重差值: {7,10,14,17,20,24,27,34} → 8个
AC值 = 8 - 4 = 4
```

#### 📋 AC值分布统计 (基于324,632条记录)

| AC值 | 数量 | 占比 | 说明 |
|------|------|------|------|
| AC=0 | 136 | 0.04% | 极度集中（连号） |
| AC=1 | 505 | 0.16% | 高度集中 |
| AC=2 | 8,305 | 2.56% | 较集中 |
| AC=3 | 14,700 | 4.53% | 中度集中 |
| **AC=4** | **79,652** | **24.54%** | **较分散 ⭐** |
| **AC=5** | **84,276** | **25.96%** | **分散 ⭐** |
| **AC=6** | **137,058** | **42.22%** | **高度分散 ⭐** |

**推荐配置**: AC=4,5,6 (占比约93%) ⭐

#### 🎨 前端UI配置

**默认选中**: AC=4, 5, 6

**快捷预设**:
```html
<button onclick="selectAcPosPreset('low')">低AC (0-2)</button>
<button onclick="selectAcPosPreset('mid')">中AC (3-4)</button>
<button onclick="selectAcPosPreset('high')">高AC (5-6)</button>
<button onclick="selectAcPosPreset('balanced')">推荐 (4-6) ⭐</button>
<button onclick="selectAcPosPreset('all')">全选7种</button>
```

#### 💻 后端处理逻辑

```javascript
// Step 6: AC值筛选
if (positive_selection.ac_values && positive_selection.ac_values.length > 0) {
    const beforeCount = combinations.length;
    combinations = combinations.filter(combo =>
        positive_selection.ac_values.includes(combo.ac_value)
    );
    log(`  Step 6 - AC值筛选: ${beforeCount} -> ${combinations.length} 个组合 (条件: ${positive_selection.ac_values.join(', ')})`);
}

log(`  ✅ 正选筛选完成: ${combinations.length} 个红球组合`);
```

**日志输出示例**:
```
  Step 6 - AC值筛选: 42,345 -> 38,567 个组合 (条件: 4, 5, 6)
  ✅ 正选筛选完成: 38,567 个红球组合
```

---

## 🔧 排除条件 (可选步骤)

正选筛选完成后，可以进一步应用排除条件来精细化筛选。

### 排除条件1: 连号组数排除

**位置**: `src/server/server.js` lines 18649-18683

**定义**: 连续号码形成的组数

**示例**:
```
组合: 5-6-7-15-23
连号分析: 5-6-7 (一组3连号)
连号组数: 1

组合: 2-3-8-9-15
连号分析: 2-3 (一组2连号), 8-9 (一组2连号)
连号组数: 2
```

**可排除值**: 0, 1, 2, 3, 4

**用途**: 避免过多连号组合

### 排除条件2: 最长连号长度排除

**位置**: `src/server/server.js` lines 18685-18719

**定义**: 连续号码序列的最大长度

**示例**:
```
组合: 5-6-7-8-15
最长连号: 5-6-7-8 (长度4)

组合: 3-5-7-9-11
最长连号: 无连号 (长度0)
```

**可排除值**: 0, 1, 2, 3, 4, 5

**用途**: 控制连号的最长长度

---

## 🎨 前端API调用

### API端点

```
POST /api/dlt/hwc-positive-tasks/create
```

### 请求数据结构

```javascript
{
    task_name: "热温冷正选预测_2025-11-02",

    // 期号范围配置
    period_range: {
        type: "custom",        // "all" | "recent" | "custom"
        value: {
            start: "25115",    // 起始期号
            end: "25120"       // 结束期号
        }
        // OR
        // type: "recent",
        // value: 100         // 最近100期
    },

    // 正选条件
    positive_selection: {
        enabled: true,

        // Step 1: 热温冷比 (必选至少1个)
        hwc_ratios: ["2:2:1", "2:1:2", "1:2:2", "3:1:1", "1:3:1", "2:3:0", "3:2:0", "1:2:2"],

        // Step 2: 区间比 (可选)
        zone_ratios: ["2:2:1", "2:1:2", "1:2:2", "3:1:1", "1:3:1"],

        // Step 3: 和值范围 (可选)
        sum_ranges: [
            { min: 65, max: 90 },
            { min: 91, max: 115 }
        ],

        // Step 4: 跨度范围 (可选)
        span_ranges: [
            { min: 18, max: 25 },
            { min: 26, max: 32 }
        ],

        // Step 5: 奇偶比 (可选)
        odd_even_ratios: ["2:3", "3:2"],

        // Step 6: AC值 (可选)
        ac_values: [4, 5, 6]
    },

    // 排除条件 (可选)
    exclusion_conditions: {
        // 连号组数排除
        consecutiveGroups: {
            enabled: false,
            groups: [3, 4]     // 排除3连号和4连号
        },

        // 最长连号长度排除
        maxConsecutiveLength: {
            enabled: false,
            lengths: [4, 5]    // 排除长度为4和5的连号
        },

        // 配对模式
        pairing_mode: "default"  // "default" | "truly-unlimited"
    }
}
```

### 响应数据结构

```javascript
{
    success: true,
    data: {
        task_id: "hwc-pos-20251102-abc",
        message: "任务创建成功，正在后台处理"
    }
}
```

---

## 📈 性能与统计

### 筛选效率

**典型配置的压缩率**:
```
初始:     324,632 个组合 (100%)
Step 1:   185,423 个组合 (57%) ↓ 43%
Step 2:   123,567 个组合 (38%) ↓ 19%
Step 3:    98,432 个组合 (30%) ↓ 8%
Step 4:    67,890 个组合 (21%) ↓ 9%
Step 5:    42,345 个组合 (13%) ↓ 8%
Step 6:    38,567 个组合 (12%) ↓ 1%

总压缩率: 88% (从324,632 → 38,567)
```

### 数据库查询优化

**关键索引**:
```javascript
// DLTRedCombinations 集合索引
dltRedCombinationsSchema.index({ combination_id: 1 });
dltRedCombinationsSchema.index({ zone_ratio: 1 });
dltRedCombinationsSchema.index({ odd_even_ratio: 1 });
dltRedCombinationsSchema.index({ ac_value: 1 });
dltRedCombinationsSchema.index({ sum_value: 1 });
dltRedCombinationsSchema.index({ span_value: 1 });
```

**查询性能**:
- Step 1 热温冷比筛选: ~50ms (从优化表读取)
- Step 2-6 其他筛选: ~100-200ms (基于内存数组过滤)
- 单期处理总耗时: ~300-500ms

---

## 🔍 日志输出示例

### 完整流程日志

```
🚀 开始处理热温冷正选批量预测任务: hwc-pos-20251102-abc

🔄 处理期号对: 25115 -> 25116 (1/5)
  Step 1 - 热温冷比筛选: 185,423 个组合
  📊 准备查询 DLTRedCombinations: 185,423 个ID
  📊 DLTRedCombinations 查询结果: 185,423 条记录

  Step 2 - 区间比筛选: 185,423 -> 123,567 个组合 (条件: 2:2:1, 2:1:2, 1:2:2, 3:1:1, 1:3:1)
  Step 3 - 和值范围筛选: 123,567 -> 98,432 个组合 (条件: 65-90, 91-115)
  Step 4 - 跨度范围筛选: 98,432 -> 67,890 个组合 (条件: 18-25, 26-32)
  Step 5 - 奇偶比筛选: 67,890 -> 42,345 个组合 (条件: 2:3, 3:2)
  Step 6 - AC值筛选: 42,345 -> 38,567 个组合 (条件: 4, 5, 6)

  ✅ 正选筛选完成: 38,567 个红球组合
  ✅ 所有排除条件处理完成: 38,567 个红球组合

  配对模式: default
  ✅ 配对完成 (普通无限制 1:1循环): 38,567 个组合

  🎯 开奖号码: 红[3,12,18,27,33] 蓝[5,9]
  📊 命中统计: 最高红球命中=4, 蓝球命中=2
     - 四等奖: 2注 (金额: 6,000元)
     - 五等奖: 15注 (金额: 4,500元)
     - 六等奖: 45注 (金额: 9,000元)
     ...
  💰 本期总奖金: 156,780 元

✅ 任务处理完成
   总期数: 5期
   总组合数: 192,835 个
   平均命中率: 12.3%
   总奖金: 678,450 元
```

---

## 🎯 最佳实践推荐

### 1. 推荐配置组合

**保守型配置** (压缩率 ~95%):
```javascript
hwc_ratios: ["2:2:1", "2:1:2", "1:2:2"],           // 仅3种最常见
zone_ratios: ["2:2:1", "2:1:2", "1:2:2"],          // 仅3种最常见
sum_ranges: [{ min: 70, max: 110 }],               // 核心和值区间
span_ranges: [{ min: 20, max: 30 }],               // 核心跨度区间
odd_even_ratios: ["2:3", "3:2"],                   // 最常见奇偶比
ac_values: [4, 5, 6]                               // 推荐AC值
```
**预期结果**: ~15,000-20,000 个组合

**平衡型配置** (压缩率 ~90%):
```javascript
hwc_ratios: ["2:2:1", "2:1:2", "1:2:2", "3:1:1", "1:3:1", "2:3:0", "3:2:0"],
zone_ratios: ["2:2:1", "2:1:2", "1:2:2", "3:1:1", "1:3:1"],
sum_ranges: [{ min: 65, max: 90 }, { min: 91, max: 115 }],
span_ranges: [{ min: 18, max: 25 }, { min: 26, max: 32 }],
odd_even_ratios: ["2:3", "3:2"],
ac_values: [4, 5, 6]
```
**预期结果**: ~30,000-40,000 个组合

**激进型配置** (压缩率 ~80%):
```javascript
hwc_ratios: [...],  // 选择12种平衡比例
zone_ratios: [...], // 选择12种平衡比例
sum_ranges: [{ min: 60, max: 120 }],  // 宽范围
span_ranges: [{ min: 15, max: 32 }],  // 宽范围
odd_even_ratios: ["1:4", "2:3", "3:2", "4:1"],
ac_values: [3, 4, 5, 6]
```
**预期结果**: ~60,000-80,000 个组合

### 2. 期号范围选择建议

**短期预测** (推荐):
```javascript
period_range: {
    type: "recent",
    value: 50  // 最近50期
}
```
适用于: 捕捉短期规律，快速验证

**中期预测**:
```javascript
period_range: {
    type: "recent",
    value: 100  // 最近100期
}
```
适用于: 平衡历史规律与近期趋势

**长期回测**:
```javascript
period_range: {
    type: "custom",
    value: {
        start: "24001",
        end: "25120"
    }
}
```
适用于: 验证策略的历史表现

### 3. 避免的配置陷阱

❌ **过度筛选** - 每步都选择极少选项
```javascript
hwc_ratios: ["2:2:1"],           // 仅1种 - 太严格
zone_ratios: ["2:2:1"],          // 仅1种
odd_even_ratios: ["3:2"],        // 仅1种
ac_values: [6]                   // 仅1个
// 结果: 可能只剩几百个组合，过于激进
```

❌ **无效筛选** - 每步都选择全部选项
```javascript
hwc_ratios: [...35种全选],       // 等于不筛选
zone_ratios: [...21种全选],
odd_even_ratios: [...6种全选],
ac_values: [0,1,2,3,4,5,6]
// 结果: 压缩率很低，失去筛选意义
```

✅ **合理平衡** - 每步选择常见的60-80%
```javascript
hwc_ratios: [7-12种平衡比例],    // 约占35%
zone_ratios: [5-8种平衡比例],    // 约占40%
odd_even_ratios: [2-4种],        // 约占60%
ac_values: [3-4个]               // 约占70%
```

---

## 📚 相关文档

- `AC_VALUE_IMPLEMENTATION_SUMMARY.md` - AC值实施总结
- `大乐透热温冷正选批量预测-完整流程文档.md` - 原始流程文档
- `热温冷正选批量预测-实施总结.md` - 实施总结
- `HWC_POSITIVE_TASK_ENHANCEMENT_IMPLEMENTATION.md` - 功能增强实施

---

## 🔄 版本历史

### v1.2 (2025-11-02)
- ✅ 添加AC值筛选功能 (Step 6)
- ✅ AC值数据迁移完成 (324,632条)
- ✅ 完善日志输出格式

### v1.1 (2025-10-27)
- ✅ 添加连号组数排除
- ✅ 添加最长连号长度排除
- ✅ 期号范围推算逻辑优化

### v1.0 (2025-10-26)
- ✅ 6步正选筛选核心功能
- ✅ 热温冷优化表实现
- ✅ 多模式红蓝配对
- ✅ 命中分析与奖金统计

---

**文档维护**: Claude Code Assistant
**最后审核**: 2025-11-02
**状态**: ✅ 完整且最新
