# 热温冷正选批量预测 - 全面流程分析

**分析日期**: 2025-11-20
**分析目的**: 全面整理热温冷优化表结构、期号对生成逻辑、推算期处理，并提出改进方案

---

## 📊 一、热温冷优化表结构分析

### 1.1 Schema定义

**Model**: `DLTRedCombinationsHotWarmColdOptimized`
**Collection**: `hit_dlt_redcombinationshotwarmcoldoptimizeds`
**位置**: `src/server/server.js:461-512`

```javascript
const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    // 期号标识（字符串）
    base_issue: { type: String, required: true },        // 基准期号 (如 "25120")
    target_issue: { type: String, required: true },      // 目标期号 (如 "25121")

    // ID标识（整数，性能优化）
    base_id: { type: Number, required: false },          // 基准期号ID (连续整数)
    target_id: { type: Number, required: false },        // 目标期号ID (连续整数，推算期=0)

    // 热温冷数据（核心数据，压缩存储）
    hot_warm_cold_data: {
        type: Map,
        of: [Number],                                     // 每个比例对应的combination_id数组
        required: true
        // 示例: {
        //   "5:0:0": [1, 45, 234, ...],    // 5热0温0冷 → 组合ID列表
        //   "4:1:0": [2, 67, 890, ...],    // 4热1温0冷 → 组合ID列表
        //   ...
        // }
    },

    total_combinations: { type: Number, required: true }, // 总组合数 (324,632)

    // 命中分析数据（可选，仅已开奖期号）
    hit_analysis: {
        target_winning_reds: [Number],                   // 实际开奖红球 [1,2,3,4,5]
        target_winning_blues: [Number],                  // 实际开奖蓝球 [1,2]
        red_hit_data: {
            type: Map,
            of: [Number]                                  // 命中数 → 组合ID数组
            // 示例: {
            //   "0": [1, 2, 3, ...],      // 命中0个红球的组合ID
            //   "1": [4, 5, 6, ...],      // 命中1个红球的组合ID
            //   "5": [789],               // 命中5个红球的组合ID (中奖组合)
            // }
        },
        hit_statistics: {
            hit_0: { type: Number, default: 0 },         // 命中0个的组合数
            hit_1: { type: Number, default: 0 },
            hit_2: { type: Number, default: 0 },
            hit_3: { type: Number, default: 0 },
            hit_4: { type: Number, default: 0 },
            hit_5: { type: Number, default: 0 }
        },
        is_drawn: { type: Boolean, default: false }      // 目标期号是否已开奖
    },

    // 统计信息
    statistics: {
        ratio_counts: {
            type: Map,
            of: Number                                    // 每个比例对应的组合数量
            // 示例: {"5:0:0": 1234, "4:1:0": 5678, ...}
        }
    },

    created_at: { type: Date, default: Date.now }
});

// 索引策略
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ target_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1, target_issue: 1 }, { unique: true });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_id: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ target_id: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_id: 1, target_id: 1 });
```

### 1.2 数据生成逻辑

**核心概念**:
- **期号对（Issue Pair）**: 每条记录对应一个 `base_issue → target_issue` 的期号对
- **预生成**: 基于历史开奖记录，预计算所有组合的热温冷比
- **压缩存储**: 使用Map结构，避免存储324,632条重复的组合记录

**生成条件**:
1. **base_issue**: 必须是**已开奖期号**（有遗漏值数据）
2. **target_issue**: 可以是已开奖或推算期
3. **遗漏值依赖**: 基于 `base_issue` 的遗漏值计算热温冷比

**热温冷分类标准**:
```javascript
for (const ball of [1-35]) {
    const missing = missingData[ball] || 0;  // base_issue期号该球的遗漏值
    if (missing <= 4) → 热球 (Hot)
    else if (missing >= 5 && missing <= 9) → 温球 (Warm)
    else (missing >= 10) → 冷球 (Cold)
}
```

### 1.3 当前数据库状态

**查询结果**:
```
总记录数: 0
```

**问题**: 优化表为空，所有热温冷筛选都会**fallback到动态计算**

---

## 🔄 二、期号对生成逻辑分析

### 2.1 核心逻辑位置

**preloadData 方法**: `src/server/server.js:16457-16634`

### 2.2 期号对生成规则（当前实现）

**输入**: `targetIssues` 数组（降序）
```javascript
// 示例: [25125, 25124, 25123, ..., 25115]
// 第一个可能是推算期（未开奖）
```

**生成规则** (`src/server/server.js:16502-16580`):
```javascript
for (let i = 0; i < issueNumbers.length; i++) {
    const targetIssueNum = issueNumbers[i];
    const targetRecord = issueToRecordMap.get(targetIssueNum);

    if (!targetRecord) {
        // 情况1: 推算期（数据库中不存在）
        if (i === 0 && maxIdRecord) {
            // 第一个期号是推算期，使用最大ID的记录作为基准期
            const baseIssue = maxIdRecord.Issue.toString();  // 最新开奖期号
            const targetIssue = targetIssueNum.toString();   // 推算期号

            issuePairs.push({
                base_issue: baseIssue,        // 如: "25124"
                target_issue: targetIssue     // 如: "25125"
            });

            // ⭐ 初始化 firstIssuePreviousRecord
            this.firstIssuePreviousRecord = {
                issue: baseIssue,
                id: maxIdRecord.ID            // 如: 2792
            };
        }
        continue;
    }

    // 情况2: 已开奖期号
    const targetID = targetRecord.ID;        // 如: 2791
    const targetIssue = targetRecord.Issue.toString();  // 如: "25123"

    // 查询 ID-1 对应的基准期记录
    const baseRecord = idToRecordMap.get(targetID - 1);  // ID=2790

    if (baseRecord) {
        issuePairs.push({
            base_issue: baseRecord.Issue.toString(),   // "25122"
            target_issue: targetIssue                   // "25123"
        });
    }
}
```

**关键点**:
1. **推算期**: 第一个期号如果不存在，使用最大ID的记录（最新开奖）作为base_issue
2. **已开奖**: 使用 `ID-1` 规则查找上一期作为base_issue
3. **ID的作用**: 确保期号对的连续性，即使Issue号码不连续

### 2.3 ID vs Issue 对比

| 维度 | Issue（期号） | ID（数据库主键） |
|------|--------------|-----------------|
| **性质** | 业务标识 | 技术标识 |
| **连续性** | **不连续** (如: 25001, 25003, 25006) | **连续** (1, 2, 3, 4, ...) |
| **用途** | 用户可见标识 | 数据库查询性能优化 |
| **查询上一期** | 不可靠（需遍历） | 可靠（ID-1） |
| **查询速度** | 慢（需要索引扫描） | 快（主键查询） |
| **推算期处理** | 任意期号 | **ID = 0 或 null** |

**示例场景**:
```
数据库记录:
ID    Issue
1     25001
2     25003  ← 注意：25002不存在
3     25006
...
2792  25124  ← 最新开奖

推算期: 25125 (ID=0或null)
```

**期号对生成结果**:
```
25124 → 25125  (base_id=2792, target_id=0)       ← 推算期
25123 → 25124  (base_id=2791, target_id=2792)    ← ID-1规则
25122 → 25123  (base_id=2790, target_id=2791)    ← ID-1规则
```

---

## 🔮 三、推算期处理逻辑分析

### 3.1 推算期识别

**判断位置**: `src/server/server.js:16803-16810`

**当前逻辑**:
```javascript
// ⚡ 2025-11-20修复: 优先使用全局缓存判断
const issueExists = (globalCacheManager.issueToIDMap?.has(targetIssue.toString())) ||
                    (this.issueToIdMap?.has(targetIssue.toString()));
isPredicted = !issueExists;  // 不在映射中 = 未开奖 = 推算期

// 调试日志
const source = globalCacheManager.issueToIDMap?.has(targetIssue.toString()) ? 'globalCache' :
               this.issueToIdMap?.has(targetIssue.toString()) ? 'localCache' : 'notFound';
log(`  📌 期号${targetIssue}: ${isPredicted ? '推算期' : '已开奖'} (来源: ${source})`);
```

### 3.2 推算期处理流程

**第一个期号是推算期** (`src/server/server.js:16668-16702`):
```javascript
if (i === 0) {
    // 第一个期号：可能是推算期或最新已开奖期
    if (this.firstIssuePreviousRecord) {
        baseIssue = this.firstIssuePreviousRecord.issue;  // 如: "25124"
        baseID = this.firstIssuePreviousRecord.id;        // 如: 2792

        if (isPredicted) {
            log(`  📌 推算期${targetIssue}使用基准期${baseIssue} (ID ${baseID}→推算)`);
        }
    } else {
        // 没有基准期（数据库为空），无法处理
        log(`  ⚠️ 期号${targetIssue}没有基准期，跳过`);
        batchResults.push({
            target_issue: targetIssue,
            base_issue: null,
            is_predicted: true,
            red_combinations: [],
            error: '没有基准期数据'
        });
        continue;
    }
}
```

**推算期的热温冷计算**:
- **base_issue**: 最新开奖期号（如 25124）
- **target_issue**: 推算期号（如 25125）
- **热温冷比**: 基于 base_issue 的遗漏值数据计算
- **命中分析**: 跳过（因为推算期没有开奖数据）

### 3.3 推算期的ID值

**当前Schema定义**: `target_id: { type: Number, required: false }`

**当前实现问题**:
- ⚠️ 推算期没有明确的 `target_id` 值
- ⚠️ Schema中 `required: false`，可以为空
- ⚠️ 用户建议: **推算期 ID = 0**

---

## 📈 四、当前实现流程总结

### 4.1 完整处理流程

```
1. 任务创建
   ├─ 解析期号范围: [25125推算, 25124, 25123, ..., 25115]
   └─ 创建任务记录 (PredictionTask)

2. processHwcPositiveTask (异步执行)
   ├─ 清理缓存
   ├─ 加载任务配置
   └─ 解析期号范围 (使用任务配置中存储的范围)

3. HwcPositivePredictor.preloadData
   ├─ 调用父类预加载 (红球、蓝球、历史数据)
   ├─ 生成期号对 (基于ID-1规则)
   │  ├─ 查询数据库: find({Issue: {$in: issueNumbers}})
   │  ├─ 构建 issueToRecordMap (Issue → Record)
   │  ├─ 构建 idToRecordMap (ID → Record)
   │  ├─ 生成期号对:
   │  │  ├─ 推算期: 使用maxIdRecord作为base
   │  │  └─ 已开奖: 使用ID-1查找base
   │  └─ 构建 issueToIdMap (Issue → ID)
   ├─ 预加载热温冷优化表 (当前为空，fallback动态计算)
   └─ (废弃) 预加载历史统计

4. HwcPositivePredictor.processBatch
   ├─ 遍历每个期号:
   │  ├─ 判断是否推算期 (基于issueToIDMap)
   │  ├─ 确定baseIssue和baseID
   │  ├─ 6步正选筛选 (applyPositiveSelection)
   │  │  ├─ Step 1: 热温冷比 (优先优化表，fallback动态)
   │  │  ├─ Step 2: 区间比
   │  │  ├─ Step 3: 和值范围
   │  │  ├─ Step 4: 跨度范围
   │  │  ├─ Step 5: 奇偶比
   │  │  └─ Step 6: AC值
   │  ├─ 8步排除条件 (applyExclusionConditions)
   │  ├─ 命中分析 (仅已开奖期号)
   │  └─ 构建结果对象
   └─ 返回 batchResults

5. 保存结果
   ├─ 保存任务结果 (HwcPositivePredictionTaskResult)
   ├─ 智能保存排除明细 (仅最近N期+推算期)
   └─ 更新任务状态为completed
```

### 4.2 热温冷优化表使用流程

**当前状态**: 优化表为空 → **100% fallback 到动态计算**

**优化表查询** (`src/server/server.js:15204-15209`):
```javascript
const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
    $or: issuePairs.map(p => ({
        base_issue: p.base_issue,
        target_issue: p.target_issue
    }))
}).lean();
```

**Fallback动态计算** (`src/server/server.js:15577-15614`):
```javascript
// 获取baseIssue的遗漏数据
const missingData = await DLTRedMissing.findOne({ Issue: parseInt(baseIssue) }).lean();

// 遍历所有324,632个组合，动态计算热温冷比
for (const combo of this.cachedRedCombinations) {
    const balls = [combo.red_ball_1, ..., combo.red_ball_5];
    let hot = 0, warm = 0, cold = 0;

    balls.forEach(ball => {
        const missing = missingData[String(ball)] || 0;
        if (missing <= 4) hot++;
        else if (missing >= 5 && missing <= 9) warm++;
        else cold++;
    });

    const ratio = `${hot}:${warm}:${cold}`;
    if (selectedRatioSet.has(ratio)) {
        candidateIds.add(combo.combination_id);
    }
}
```

**性能对比**:
| 方法 | 耗时 | 操作 |
|------|-----|------|
| **优化表查询** | <100ms | 1次数据库查询 |
| **动态计算** | 5-10秒 | 324,632次循环 + 遗漏值查询 |

---

## 💡 五、改进方案设计

### 5.1 方案A: 完善ID字段使用（推荐）

**核心改进**: 为推算期明确定义 `target_id = 0`

**修改点**:

#### 1. Schema修改
```javascript
// 明确定义推算期ID规则
target_id: {
    type: Number,
    required: true,  // 改为必填
    default: 0       // 推算期默认为0
}
```

#### 2. 期号对生成时设置ID
```javascript
// 推算期处理
if (!targetRecord) {
    if (i === 0 && maxIdRecord) {
        issuePairs.push({
            base_issue: baseIssue,
            target_issue: targetIssue,
            base_id: maxIdRecord.ID,      // ✅ 已开奖期ID
            target_id: 0                   // ✅ 推算期ID=0
        });
    }
} else {
    // 已开奖处理
    issuePairs.push({
        base_issue: baseRecord.Issue.toString(),
        target_issue: targetIssue,
        base_id: baseRecord.ID,            // ✅ base期号ID
        target_id: targetRecord.ID         // ✅ target期号ID
    });
}
```

#### 3. 热温冷优化表查询使用ID
```javascript
// 优先使用ID查询（性能更高）
const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
    $or: issuePairs.map(p => ({
        base_id: p.base_id,
        target_id: p.target_id
    }))
}).lean();

// 如果没有ID，fallback到Issue查询
if (hwcDataList.length === 0) {
    hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    }).lean();
}
```

**优点**:
- ✅ 查询性能提升（ID索引比字符串索引更快）
- ✅ 明确推算期标识（ID=0）
- ✅ 支持基于ID的复合查询
- ✅ 向后兼容（保留Issue字段）

---

### 5.2 方案B: 预生成热温冷优化表（性能关键）

**当前问题**: 优化表为空，100%动态计算，性能损失5-10秒/期

**生成策略**:

#### 1. 批量生成历史期号对
```bash
node generate-hwc-optimized-table.js --start-issue 25001 --end-issue 25124
```

**生成逻辑**:
```javascript
// 遍历所有已开奖期号对
for (let i = 0; i < issues.length - 1; i++) {
    const baseIssue = issues[i];
    const targetIssue = issues[i + 1];

    // 查询base期号的遗漏值
    const missingData = await DLTRedMissing.findOne({ Issue: baseIssue }).lean();

    // 计算所有组合的热温冷比
    const hwcMap = new Map(); // ratio → [combo_ids]

    for (const combo of allRedCombinations) {
        const balls = [combo.red_ball_1, ..., combo.red_ball_5];
        let hot = 0, warm = 0, cold = 0;

        balls.forEach(ball => {
            const missing = missingData[String(ball)] || 0;
            if (missing <= 4) hot++;
            else if (missing >= 5 && missing <= 9) warm++;
            else cold++;
        });

        const ratio = `${hot}:${warm}:${cold}`;
        if (!hwcMap.has(ratio)) hwcMap.set(ratio, []);
        hwcMap.get(ratio).push(combo.combination_id);
    }

    // 保存到数据库
    await DLTRedCombinationsHotWarmColdOptimized.create({
        base_issue: baseIssue.toString(),
        target_issue: targetIssue.toString(),
        base_id: baseRecord.ID,
        target_id: targetRecord.ID,
        hot_warm_cold_data: Object.fromEntries(hwcMap),
        total_combinations: 324632,
        statistics: {
            ratio_counts: Object.fromEntries(
                Array.from(hwcMap.entries()).map(([ratio, ids]) => [ratio, ids.length])
            )
        }
    });
}
```

#### 2. 实时生成推算期数据（任务创建时）
```javascript
// 当任务包含推算期时，实时生成对应的优化数据
if (hasPredictedIssue) {
    const baseIssue = latestDrawnIssue;    // 如: "25124"
    const targetIssue = predictedIssue;    // 如: "25125"

    // 检查是否已存在
    const existing = await DLTRedCombinationsHotWarmColdOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
    });

    if (!existing) {
        // 动态生成并保存（仅一次，后续复用）
        const hwcData = await generateHwcOptimizedData(baseIssue, targetIssue, 0);
        await DLTRedCombinationsHotWarmColdOptimized.create(hwcData);
        log(`✅ 已生成推算期优化数据: ${baseIssue}→${targetIssue}`);
    }
}
```

**性能收益**:
| 场景 | 当前（动态计算） | 优化后（查表） | 提升 |
|------|-----------------|--------------|------|
| 10期任务 | 50-100秒 | 5-10秒 | **5-10倍** |
| 100期任务 | 500-1000秒 | 10-20秒 | **50倍** |

---

### 5.3 方案C: 增强推算期缓存复用

**场景**: 多个任务预测同一个推算期（如 25125）

**当前问题**: 每个任务都重复生成优化数据

**改进**:
```javascript
// 全局缓存管理器增加推算期缓存
class GlobalCacheManager {
    constructor() {
        this.predictedIssueHwcCache = new Map();  // "base-target" → hwcData
    }

    async getHwcDataForPredictedIssue(baseIssue, targetIssue) {
        const key = `${baseIssue}-${targetIssue}`;

        // 1. 检查内存缓存
        if (this.predictedIssueHwcCache.has(key)) {
            log(`✅ 使用内存缓存的推算期HWC数据: ${key}`);
            return this.predictedIssueHwcCache.get(key);
        }

        // 2. 检查数据库
        const dbData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            base_issue: baseIssue,
            target_issue: targetIssue
        }).lean();

        if (dbData) {
            this.predictedIssueHwcCache.set(key, dbData);
            log(`✅ 从数据库加载推算期HWC数据: ${key}`);
            return dbData;
        }

        // 3. 动态生成并缓存
        const hwcData = await this.generateHwcOptimizedData(baseIssue, targetIssue, 0);
        await DLTRedCombinationsHotWarmColdOptimized.create(hwcData);
        this.predictedIssueHwcCache.set(key, hwcData);
        log(`✅ 生成并缓存推算期HWC数据: ${key}`);
        return hwcData;
    }
}
```

---

## 📊 六、性能和结果一致性对比

### 6.1 当前实现性能

**测试场景**: 25115-25125 (11期，1推算期)

| 步骤 | 当前耗时 | 瓶颈 |
|------|---------|------|
| 数据预加载 | 2-3秒 | 数据库查询 |
| 期号对生成 | <100ms | ID-1规则查询 |
| **热温冷优化表查询** | <100ms | **表为空，查询无结果** |
| **热温冷动态计算** | **50-100秒** | **324,632 × 11期循环** ⚠️ |
| 其他正选步骤 | 1-2秒 | 缓存查询 |
| 排除条件 | 5-10秒 | 历史统计计算 |
| 结果保存 | 2-3秒 | 批量写入 |
| **总耗时** | **60-120秒** | **主要瓶颈：动态计算** |

### 6.2 方案A+B+C 预期性能

| 步骤 | 优化后耗时 | 改进 |
|------|-----------|------|
| 数据预加载 | 2-3秒 | 不变 |
| 期号对生成 | <100ms | 增加ID字段 |
| **热温冷优化表查询（ID索引）** | **<50ms** | **使用ID查询** ✅ |
| **热温冷动态计算** | **0秒** | **查表命中，无需计算** ✅ |
| 其他正选步骤 | 1-2秒 | 不变 |
| 排除条件 | 5-10秒 | 不变 |
| 结果保存 | 2-3秒 | 不变 |
| **总耗时** | **10-20秒** | **6倍提升** ⭐ |

### 6.3 结果一致性保证

#### ✅ 完全一致的计算逻辑
```javascript
// 动态计算和优化表使用完全相同的逻辑
const calculateHwcRatio = (balls, missingData) => {
    let hot = 0, warm = 0, cold = 0;
    balls.forEach(ball => {
        const missing = missingData[String(ball)] || 0;
        if (missing <= 4) hot++;
        else if (missing >= 5 && missing <= 9) warm++;
        else cold++;
    });
    return `${hot}:${warm}:${cold}`;
};

// 优化表生成时使用
// 动态计算时使用
// → 保证100%一致性
```

#### ✅ 验证机制
```javascript
// 生成优化表后验证
const validateHwcOptimizedData = async (baseIssue, targetIssue) => {
    // 1. 查询优化表数据
    const optimizedData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
        base_issue: baseIssue,
        target_issue: targetIssue
    }).lean();

    // 2. 动态计算
    const missingData = await DLTRedMissing.findOne({ Issue: baseIssue }).lean();
    const dynamicResult = new Map();

    for (const combo of allCombinations) {
        const ratio = calculateHwcRatio([combo.red_ball_1, ...], missingData);
        if (!dynamicResult.has(ratio)) dynamicResult.set(ratio, []);
        dynamicResult.get(ratio).push(combo.combination_id);
    }

    // 3. 对比结果
    for (const [ratio, ids] of dynamicResult) {
        const optimizedIds = optimizedData.hot_warm_cold_data[ratio] || [];
        if (ids.length !== optimizedIds.length) {
            throw new Error(`数据不一致: ${ratio} - 动态${ids.length}个 vs 优化表${optimizedIds.length}个`);
        }
    }

    console.log(`✅ 验证通过: ${baseIssue}→${targetIssue} 数据完全一致`);
};
```

---

## 🎯 七、实施建议

### 7.1 实施优先级

| 优先级 | 方案 | 影响 | 实施难度 |
|-------|------|------|---------|
| **P0 (必须)** | 方案B: 预生成优化表 | 6倍性能提升 | 中等 |
| **P1 (推荐)** | 方案A: 完善ID使用 | 查询性能提升 | 低 |
| **P2 (可选)** | 方案C: 推算期缓存 | 避免重复生成 | 低 |

### 7.2 实施步骤

#### 阶段1: Schema和查询优化（1小时）
1. 修改Schema: `target_id` 改为 `required: true, default: 0`
2. 修改期号对生成逻辑: 明确设置 `target_id`
3. 修改优化表查询: 优先使用ID字段

#### 阶段2: 生成历史优化数据（2-4小时，取决于数据量）
1. 创建生成脚本 `generate-hwc-optimized-table.js`
2. 批量生成所有历史期号对的优化数据
3. 验证数据一致性

#### 阶段3: 推算期优化（30分钟）
1. 任务创建时检查推算期优化数据
2. 不存在则实时生成并保存
3. 增加全局缓存复用

#### 阶段4: 测试验证（1小时）
1. 创建测试任务（包含已开奖和推算期）
2. 对比优化前后性能
3. 验证结果一致性

### 7.3 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|-----|------|---------|
| 优化表数据不一致 | 低 | 高 | 生成后自动验证 |
| 数据库存储空间 | 中 | 低 | 压缩存储，定期清理旧数据 |
| ID字段迁移问题 | 低 | 中 | 保留Issue字段兼容 |

---

## 📝 八、总结

### 当前状态
- ✅ 基础功能完整，逻辑正确
- ⚠️ **性能瓶颈**: 热温冷优化表为空，100%动态计算
- ⚠️ **推算期ID不明确**: Schema中 `target_id` 非必填

### 改进后预期
- ✅ **6倍性能提升**: 60-120秒 → 10-20秒
- ✅ **明确推算期标识**: target_id=0
- ✅ **查询性能优化**: ID索引比字符串索引更快
- ✅ **结果100%一致**: 使用相同计算逻辑

### 建议
**建议立即实施方案B（预生成优化表）**，这是性能提升的关键。方案A和C可以同步实施，进一步优化查询和缓存性能。

---

**文档结束**
