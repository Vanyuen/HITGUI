# HIT大乐透 - 批量预测系统架构说明

## 🔍 问题根因

**同出排除功能未生效的真正原因**: 使用了**旧的任务系统**,该系统不支持同出排除!

## 📊 两套批量预测系统对比

### 系统1: 旧任务系统 (当前使用)
**特征**:
- API路径: 未明确(可能是任务队列API)
- 实现方式: MongoDB查询构建器
- 核心函数: `buildRedQueryFromExcludeConditions`
- 位置: `server.js:12264-12390`

**支持的排除条件**:
- ✅ 和值排除 (MongoDB `$nor` 查询)
- ✅ 跨度排除 (MongoDB `$nor` 查询)
- ✅ 区间比排除 (MongoDB `$nin` 查询)
- ✅ 奇偶比排除 (MongoDB `$nin` 查询)

**不支持的排除条件**:
- ❌ 同出排除 (需要内存过滤)
- ❌ 相克排除 (需要内存过滤)
- ❌ 热温冷比排除 (需要内存过滤)

**为什么不支持**:
- 同出/相克需要查找"号码对",无法用MongoDB查询表达
- 必须先获取所有组合,然后在内存中逐个检查

---

### 系统2: 新的StreamBatchPredictor (支持同出排除)
**特征**:
- API路径: `/api/dlt/batch-prediction`
- 实现方式: 内存中流式过滤
- 核心类: `StreamBatchPredictor`
- 位置: `server.js:9593-9900`

**支持的排除条件**:
- ✅ 和值排除
- ✅ 跨度排除
- ✅ 区间比排除
- ✅ 奇偶比排除
- ✅ **同出排除** ← 关键!
- ✅ **相克排除**
- ✅ **热温冷比排除**

**实现原理**:
```javascript
// 1. 获取基础组合
let allCombinations = await DLTRedCombination.find({}).limit(maxCount).lean();

// 2. 应用相克排除 (内存过滤)
if (filters.conflictExclude?.enabled) {
    const conflictPairs = await this.getConflictPairs(issue, filters.conflictExclude);
    allCombinations = allCombinations.filter(combo => {
        // 检查是否包含相克对
    });
}

// 3. 应用同出排除 (内存过滤)
if (exclude_conditions.coOccurrence?.enabled) {
    const coOccurrencePairs = await this.getCoOccurrencePairs(issue, periods);
    allCombinations = allCombinations.filter(combo => {
        // 检查是否包含同出对
    });
}
```

---

## 🔄 如何切换到新系统

### 方法1: 修改前端调用新API
修改 `src/renderer/dlt-module.js` 中批量预测的提交逻辑:

```javascript
// ❌ 旧系统API (不支持同出排除)
// POST /api/dlt/tasks

// ✅ 新系统API (支持同出排除)
POST /api/dlt/batch-prediction

// 请求体:
{
    "targetIssues": ["25078", "25079", ...],  // 或使用rangeConfig
    "filters": { ... },
    "exclude_conditions": {
        "coOccurrence": {
            "enabled": true,
            "periods": 1
        }
    },
    "combinationMode": "unlimited",  // 或 "default" / "truly-unlimited"
    "enableValidation": true
}
```

### 方法2: 升级旧系统支持同出排除
在旧系统的处理流程中,添加同出排除的内存过滤步骤。

---

## 📝 当前日志分析

### 日志证据
```
📋 排除条件: { "coOccurrence": { "enabled": true, "periods": 1 } }
🔧 开始构建排除条件查询...  ← 这是旧系统!
🔧 查询构建完成: {}              ← 同出排除被忽略
🔍 构建的查询条件: {}
...
ℹ️ 未设置热温冷比排除条件       ← 旧系统的日志
ℹ️ 未设置相克排除条件           ← 旧系统的日志
✅ 最终红球组合数: 324632        ← 未减少!
```

**关键标识**: `🔧 开始构建排除条件查询` 这个日志来自 `buildRedQueryFromExcludeConditions` 函数,是旧系统的标志。

### 新系统的日志格式
```
🔎 [session_xxx] 获取红球组合 - 期号:25078, 最大数量:324632
🔍 [session_xxx] 过滤条件详情: { ... }
🔍 [session_xxx] 排除条件详情: { "coOccurrence": { "enabled": true, "periods": 1 } }
...
🔗 [session_xxx] 开始同出排除过滤... 最近1期
🔗 [session_xxx] 查询到1期遗漏值数据: 25077
🔗 [session_xxx] 详细分布: 25077期[12,14,16,19,28]
🔗 [session_xxx] 获取到10对同出号码
🔗 [session_xxx] 同出过滤后: XXX个组合 (排除YYY个)
```

---

## 🎯 解决方案

### 推荐方案: 切换到新系统API

#### 步骤1: 找到前端批量预测提交代码
搜索关键字: `批量预测` / `batch` / `createTask`

#### 步骤2: 修改API调用
```javascript
// 修改前
const response = await fetch('/api/dlt/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        taskType: 'batch-prediction',
        periods: targetIssues,
        filters: filters
    })
});

// 修改后
const response = await fetch('/api/dlt/batch-prediction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        targetIssues: targetIssues,
        filters: filters,
        exclude_conditions: {
            coOccurrence: filters.coOccurrence  // 同出排除
        },
        combinationMode: 'unlimited',
        enableValidation: true
    })
});
```

#### 步骤3: 测试验证
重启应用后,应该看到新系统的日志格式,同出排除生效。

---

## 🔧 代码位置参考

### 新系统 (StreamBatchPredictor)
| 功能 | 文件 | 行号 |
|------|------|------|
| API入口 | server.js | 10305-10530 |
| 流式预测器 | server.js | 9593-9900 |
| 红球过滤 | server.js | 9774-9850 |
| 同出排除 | server.js | 9823-9846 |
| 同出API | server.js | 2642-2736 |

### 旧系统 (任务队列)
| 功能 | 文件 | 行号 |
|------|------|------|
| 查询构建器 | server.js | 12264-12390 |
| 和值排除 | server.js | 12274-12304 |
| 跨度排除 | server.js | 12306-12336 |
| 区间比排除 | server.js | 12338-12364 |
| 奇偶比排除 | server.js | 12366-12386 |

---

## ✅ 修复检查清单

- [ ] 确认前端使用哪个API
- [ ] 切换到 `/api/dlt/batch-prediction`
- [ ] 确保 `exclude_conditions.coOccurrence` 正确传递
- [ ] 重启应用测试
- [ ] 检查日志中是否有 `🔗 [session_xxx]` 开头的同出排除日志
- [ ] 验证组合数是否减少

---

## 📌 总结

**问题**: 同出排除功能代码没问题,但**使用了不支持同出排除的旧任务系统**!

**解决**: 切换到新的 `StreamBatchPredictor` 系统 (`/api/dlt/batch-prediction`)

**验证**: 日志中应出现 `🔗 [session_xxx] 同出过滤后: XXX个组合 (排除YYY个)`

---

请确认前端批量预测使用的是哪个API,然后我可以帮你修改!
