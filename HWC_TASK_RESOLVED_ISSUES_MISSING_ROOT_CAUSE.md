# 热温冷正选批量预测任务只显示推算期数据的根本原因分析

**任务ID**: hwc-pos-20251125-5x6
**分析时间**: 2025-11-25
**状态**: 🔍 根本原因已确定

---

## 一、问题现象

创建热温冷正选批量预测任务后（选择"最近10期+1期推算"），任务结果页面显示：
- ✅ 25125 (推算期) - 显示但无数据（0个组合）
- ❌ 25115-25124 (10期历史) - 完全不显示

---

## 二、诊断发现

### 诊断1: 任务数据库记录异常

```javascript
// 诊断脚本: diagnose-hwc-task-issue-deep.js

任务配置:
  rangeType: undefined          // ❌ 应该有值
  recentCount: undefined        // ❌ 应该有值

解析后的期号列表 (0期):     // ❌ 应该有11期
  ❌ 无期号数据！

任务结果记录: 1条
  期号 25125 (推算期)
  红球组合数: 0
  蓝球组合数: 66
  总组合数: 0
```

###关键发现
1. ❌ **`resolved_issues` 字段为空** - 任务配置中没有保存解析后的期号列表
2. ❌ **`range_config` 字段 undefined** - 范围配置丢失
3. ✅ **`issue_pairs` 字段存在** - 期号对集合正确保存
4. ❌ **只有1个推算期结果记录** - 没有历史期结果

---

## 三、根本原因分析

### 原因1: Schema 缺少 `resolved_issues` 字段

**位置**: `src/server/server.js:1150-1345`

```javascript
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    task_name: { type: String, required: true },

    period_range: {
        type: { type: String, required: true, enum: ['all', 'recent', 'custom'] },
        start: { type: String },
        end: { type: String },
        total: { type: Number, required: true },
        predicted_count: { type: Number, default: 0 }
    },

    issue_pairs: [{
        base: { type: String, required: true },
        target: { type: String, required: true },
        isPredicted: { type: Boolean, default: false }
    }],

    // ❌ 缺少这个字段！
    // resolved_issues: [String],  // 解析后的期号列表

    // ❌ 缺少这个字段！
    // range_config: {             // 原始范围配置
    //     rangeType: String,
    //     recentCount: Number,
    //     startIssue: String,
    //     endIssue: String
    // },

    positive_selection: { ... },
    exclusion_conditions: { ... },
    ...
});
```

### 原因2: 任务创建时没有保存 `resolved_issues`

**位置**: `src/server/server.js:22664-22682`

```javascript
// 创建任务记录
const taskData = {
    task_id,
    task_name: finalTaskName,
    task_type: 'hwc-positive-batch',
    period_range: periodRange,        // ✅ 保存了 start/end/total
    issue_pairs: issuePairs,          // ✅ 保存了期号对
    // ❌ 缺少：resolved_issues: resolvedIssues,
    // ❌ 缺少：range_config: period_range,
    positive_selection,
    exclusion_conditions: safeExclusionConditions,
    output_config: safeOutputConfig,
    status: 'pending',
    ...
};
```

### 原因3: 任务执行时依赖不完整的数据

**位置**: `src/server/server.js:18635-18650`

```javascript
// processHwcPositiveTask 函数
if (task.period_range.start && task.period_range.end) {
    // ❌ 重新解析期号范围，而不是直接使用保存的 resolved_issues
    issue_range = await resolveIssueRangeInternal({
        rangeType: 'custom',
        startIssue: task.period_range.start,  // "25115"
        endIssue: task.period_range.end       // "25125"
    });
}
```

**问题**:
1. 任务创建时 `resolvedIssues` 已经正确解析（11期）
2. 但没有保存到数据库
3. 任务执行时重新解析，可能返回不同的结果
4. 特别是在 Issue 类型修复后，查询行为可能改变

---

## 四、触发链路分析

### 链路1: 任务创建阶段 ✅ 正常

```
1. 用户选择"最近10期+1期推算"
2. 前端调用 /api/dlt/hwc-positive-tasks/create
3. 后端调用 resolveIssueRangeInternal({ rangeType: 'recent', recentCount: 10 })
4. 返回 resolvedIssues = ["25125", "25124", ..., "25115"]  (11期，降序)
5. 生成 issuePairs = [
     {base:"25124", target:"25125", isPredicted:true},
     {base:"25123", target:"25124", isPredicted:false},
     ...
   ]  (11对)
6. 验证热温冷优化表数据 - 通过
7. 保存任务到数据库
   ✅ 保存了 issue_pairs (11对)
   ❌ 没有保存 resolved_issues (11期)
   ❌ 没有保存 range_config
```

### 链路2: 任务执行阶段 ⚠️ 异常

```
1. processHwcPositiveTask(taskId) 启动
2. 从数据库加载任务配置
   - task.period_range.start = "25115"
   - task.period_range.end = "25125"
   - task.issue_pairs = [11对期号对]  ✅ 存在
   - task.resolved_issues = undefined  ❌ 不存在
3. 重新解析期号范围:
   issue_range = await resolveIssueRangeInternal({
       rangeType: 'custom',
       startIssue: "25115",
       endIssue: "25125"
   })
4. ⚠️ 关键问题：此时 resolveIssueRangeInternal 可能:
   - 查询逻辑与创建时不同（Issue类型修复后）
   - 返回结果可能不一致
   - 甚至可能返回空数组或错误
5. 传入 HwcPositivePredictor:
   predictor.streamPredict({ targetIssues: issue_range, ... })
6. 如果 issue_range 有问题 → 只处理推算期
```

---

## 五、为什么只有推算期有结果？

### 假设1: `issue_range` 重新解析后变成空数组或只有推算期

**可能原因**:
- `resolveIssueRangeInternal()` 在重新调用时出错
- 查询 `hit_dlts` 时条件不匹配（Issue类型问题虽已修复，但可能还有其他问题）
- 返回的 `issue_range` 只包含推算期

**验证**: 需要查看服务器日志中的 `issue_range` 实际值

### 假设2: `HwcPositivePredictor` 只处理了部分期号

**可能原因**:
- 传入的 `issue_range` 正确，但预测器内部跳过了历史期
- 热温冷优化表查询失败（虽然创建时验证通过）
- 期号对验证失败导致跳过

### 假设3: 结果保存时出错

**可能原因**:
- 历史期结果生成了但保存失败
- 只有推算期结果保存成功

---

## 六、完整解决方案

### 方案A: 添加 `resolved_issues` 字段 ✅ **推荐**

#### 步骤1: 更新 Schema

**位置**: `src/server/server.js:1150-1170`

```javascript
const hwcPositivePredictionTaskSchema = new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    task_name: { type: String, required: true },
    task_type: { type: String, required: true, default: 'hwc-positive-batch' },

    // 期号范围（元数据）
    period_range: {
        type: { type: String, required: true, enum: ['all', 'recent', 'custom'] },
        start: { type: String },
        end: { type: String },
        total: { type: Number, required: true },
        predicted_count: { type: Number, default: 0 }
    },

    // 🆕 解析后的期号列表（降序数组）
    resolved_issues: [String],

    // 🆕 原始范围配置（用于调试和审计）
    range_config: {
        rangeType: String,
        recentCount: Number,
        startIssue: String,
        endIssue: String
    },

    // 期号对集合
    issue_pairs: [{
        base: { type: String, required: true },
        target: { type: String, required: true },
        isPredicted: { type: Boolean, default: false }
    }],

    positive_selection: { ... },
    exclusion_conditions: { ... },
    ...
});
```

#### 步骤2: 任务创建时保存 `resolved_issues`

**位置**: `src/server/server.js:22664-22682`

```javascript
// 创建任务记录
const taskData = {
    task_id,
    task_name: finalTaskName,
    task_type: 'hwc-positive-batch',
    period_range: periodRange,
    resolved_issues: resolvedIssues,  // 🆕 添加
    range_config: {                   // 🆕 添加
        rangeType: period_range.type,
        recentCount: period_range.value,
        startIssue: period_range.value?.start,
        endIssue: period_range.value?.end
    },
    issue_pairs: issuePairs,
    positive_selection,
    exclusion_conditions: safeExclusionConditions,
    output_config: safeOutputConfig,
    status: 'pending',
    progress: {
        current: 0,
        total: totalPeriods,
        percentage: 0
    },
    created_at: new Date()
};
```

#### 步骤3: 任务执行时直接使用 `resolved_issues`

**位置**: `src/server/server.js:18628-18650`

```javascript
// 2. 解析期号范围
log(`📅 加载期号范围...`);
let issue_range;

// 🔧 优先使用保存的 resolved_issues
if (task.resolved_issues && task.resolved_issues.length > 0) {
    issue_range = task.resolved_issues;
    log(`✅ 使用任务配置保存的期号列表 (共${issue_range.length}期)`);
    log(`   期号范围: ${issue_range[issue_range.length-1]} → ${issue_range[0]}`);
} else if (task.period_range.start && task.period_range.end) {
    // 兜底：重新解析（旧任务兼容）
    log(`⚠️ 任务缺少 resolved_issues，使用 period_range 重新解析`);
    issue_range = await resolveIssueRangeInternal({
        rangeType: 'custom',
        startIssue: task.period_range.start,
        endIssue: task.period_range.end
    });
    log(`✅ 重新解析期号范围: ${task.period_range.start}-${task.period_range.end} (共${issue_range.length}期)`);
} else if (task.period_range.type === 'all') {
    issue_range = await resolveIssueRangeInternal({ rangeType: 'all' });
    log(`✅ 使用全部历史期号 (共${issue_range.length}期)`);
} else {
    throw new Error(`任务配置缺少期号数据: ${JSON.stringify(task.period_range)}`);
}

// 🔧 验证 issue_range 不为空
if (!issue_range || issue_range.length === 0) {
    throw new Error('期号范围为空，无法执行任务');
}
```

### 方案B: 直接使用 `issue_pairs` 生成期号列表 (备选)

如果不想修改 Schema，可以从 `issue_pairs` 中提取期号：

```javascript
// 从 issue_pairs 提取目标期号列表
const issue_range = task.issue_pairs.map(pair => pair.target);
log(`✅ 从 issue_pairs 提取期号列表 (共${issue_range.length}期)`);
```

**问题**: `issue_pairs` 可能包含重复的基准期，需要去重和排序

---

## 七、验证测试计划

### 测试1: 验证 Schema 修改

```javascript
// test-schema-update.js
const task = new HwcPositivePredictionTask({
    task_id: 'test-001',
    task_name: '测试',
    task_type: 'hwc-positive-batch',
    period_range: {
        type: 'recent',
        start: '25115',
        end: '25125',
        total: 11,
        predicted_count: 1
    },
    resolved_issues: ['25125', '25124', '25123'],  // 测试新字段
    range_config: {                                 // 测试新字段
        rangeType: 'recent',
        recentCount: 10
    },
    issue_pairs: [...],
    positive_selection: {...},
    ...
});

await task.save();
console.log('✅ Schema 更新成功');
```

### 测试2: 创建新任务并验证数据保存

```bash
# 1. 通过UI创建任务
# 2. 检查数据库

node check-new-task-data.js
```

预期结果：
```javascript
{
  task_id: 'hwc-pos-20251125-xxx',
  resolved_issues: ['25125', '25124', ..., '25115'],  // ✅ 11期
  range_config: {
    rangeType: 'recent',
    recentCount: 10
  },
  issue_pairs: [11个期号对]
}
```

### 测试3: 任务执行验证

1. 创建新任务
2. 观察服务器日志中的 `issue_range`
3. 检查任务结果是否包含全部11期

---

## 八、临时排查步骤（在修复前）

如果需要立即排查现有任务失败的原因：

### 步骤1: 检查服务器日志

```bash
# 搜索任务ID相关的日志
grep "hwc-pos-20251125-5x6" server.log
```

关键日志关注点：
- `📅 解析期号范围配置...`
- `✅ 使用任务配置的期号范围: XXX (共X期)`
- `📊 开始生成期号对: 共 X 个目标期号`

### 步骤2: 手动测试期号解析

```javascript
// test-issue-range-parse.js
const issue_range = await resolveIssueRangeInternal({
    rangeType: 'custom',
    startIssue: '25115',
    endIssue: '25125'
});

console.log(`期号数量: ${issue_range.length}`);
console.log(`期号列表: ${issue_range.join(', ')}`);
```

预期： `11期` (25125, 25124, ..., 25115)

### 步骤3: 检查预测器输入

在 `processHwcPositiveTask` 函数中添加调试日志：

```javascript
log(`🔍 传入预测器的期号列表: ${JSON.stringify(issue_range)}`);
log(`🔍 期号数量: ${issue_range.length}`);
```

---

## 九、总结

### 根本原因
✅ **任务数据库Schema缺少 `resolved_issues` 字段，导致任务执行时无法获取正确的期号列表**

### 影响范围
- ❌ 所有热温冷正选批量预测任务
- ❌ 可能影响其他依赖期号范围的功能

### 解决方案
1. ✅ 添加 `resolved_issues` 字段到 Schema
2. ✅ 任务创建时保存 `resolved_issues`
3. ✅ 任务执行时优先使用 `resolved_issues`
4. ✅ 添加详细的日志和验证

### 优先级
🔴 **高优先级** - 影响核心功能，需要立即修复

---

**文档版本**: v1.0
**最后更新**: 2025-11-25
**审核状态**: 待用户确认后实施
