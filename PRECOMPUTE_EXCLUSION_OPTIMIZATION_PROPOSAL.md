# 相克对&同出排除预计算优化方案

**提案日期**: 2025-01-03
**问题**: 相克对和同出组合排除每期都要重新计算，51期任务需要重复计算51次，严重影响性能
**目标**: 任务创建时预计算，运行时直接读取，预期性能提升30-50%

---

## 📊 当前性能瓶颈分析

### 相克对排除 (`getConflictPairs`)

**当前实现** (Line 13309-13470):
```javascript
async getConflictPairs(targetIssue, conflictConfig) {
    // 每期都要:
    // 1. 查询前N期历史数据（例如2700期）
    // 2. 遍历统计35x35相克矩阵（1225个计数器）
    // 3. 排序获取TopN相克对
    // 4. 统计热号并进行热号保护
    // 耗时: 约200-500ms/期
}
```

**性能问题**:
- 51期任务 = 51次重复计算
- 每次都查询大量历史数据（2700期 × 51次）
- 每次都重新构建相克矩阵
- **总耗时**: 51 × 300ms = **15.3秒**

---

### 同出组合排除 (`getExcludeComboFeaturesPerBall`)

**当前实现** (Line 13102-13214):
```javascript
async getExcludeComboFeaturesPerBall(targetIssue, periods, options) {
    // 每期都要:
    // 1. 调用同出API（查询35个红球的遗漏值）
    // 2. 对每个红球倒推最近N次出现
    // 3. 查询涉及期号的组合特征
    // 4. 聚合待排除的2码/3码/4码特征
    // 耗时: 约150-300ms/期
}
```

**性能问题**:
- 51期任务 = 51次API调用 + 51次特征查询
- 每个红球独立倒推路径
- 重复查询组合特征表
- **总耗时**: 51 × 200ms = **10.2秒**

---

## 💡 优化方案对比

### 方案A：任务级预计算（推荐⭐）

**核心思想**: 任务创建时，批量预计算所有期号的排除数据，存储到任务表

#### 实施细节

##### 1. 扩展任务Schema

```javascript
// PredictionTask Schema新增字段
{
    // ... 现有字段 ...

    // ⚡ 新增：预计算的排除数据
    precomputed_exclusions: [{
        target_issue: { type: String, required: true },  // 目标期号

        // 相克对排除数据
        conflict_pairs: {
            pairs: [{ type: [Number] }],  // [[1,27], [3,15], ...]
            hot_numbers: [{ type: Number }],  // 热号保护列表 [7, 12, 19, ...]
            analysis_periods: { type: Number },  // 分析期数
            topN: { type: Number }  // TopN
        },

        // 同出组合排除数据（按红球）
        cooccurrence_perball: {
            exclude_features: {
                combo_2: [{ type: String }],  // ["01-03", "05-12", ...]
                combo_3: [{ type: String }],  // ["01-03-15", ...]
                combo_4: [{ type: String }]   // ["01-03-15-27", ...]
            },
            analyzed_balls: [{ type: Number }],  // 分析了哪些红球
            periods: { type: Number }  // 每个号码分析期数
        },

        // 同出组合排除数据（按期号）
        cooccurrence_byissues: {
            exclude_features: {
                combo_2: [{ type: String }],
                combo_3: [{ type: String }],
                combo_4: [{ type: String }]
            },
            analyzed_issues: [{ type: String }],  // 分析了哪些期号
            periods: { type: Number }  // 最近N期
        },

        // 元数据
        computed_at: { type: Date, default: Date.now },  // 计算时间
        cache_hit: { type: Boolean, default: false }  // 是否命中缓存
    }],

    // 预计算统计
    precompute_stats: {
        total_issues: { type: Number, default: 0 },  // 总期数
        computed_issues: { type: Number, default: 0 },  // 已计算期数
        total_time_ms: { type: Number, default: 0 },  // 总耗时
        avg_time_per_issue_ms: { type: Number, default: 0 }  // 平均耗时/期
    }
}
```

##### 2. 预计算流程

**时机**: 任务创建后、开始预测前

```javascript
// 任务创建API扩展
app.post('/api/dlt/prediction-tasks/create', async (req, res) => {
    try {
        // 1. 创建任务
        const task = new PredictionTask({
            // ... 基本信息 ...
            status: 'pending'
        });
        await task.save();

        // 2. 异步触发预计算（不阻塞响应）
        setImmediate(() => {
            precomputeExclusionsForTask(task._id).catch(err => {
                log(`预计算失败: ${err.message}`);
            });
        });

        // 3. 立即返回任务ID
        res.json({ success: true, task_id: task._id });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
```

**预计算函数**:
```javascript
async function precomputeExclusionsForTask(taskId) {
    const task = await PredictionTask.findById(taskId);
    if (!task) return;

    log(`🔧 开始预计算任务 ${taskId} 的排除数据...`);
    const startTime = Date.now();

    const precomputedData = [];
    const targetIssues = task.target_issues || [];

    // ⚡ 批量预计算策略
    for (const targetIssue of targetIssues) {
        const issueData = {
            target_issue: targetIssue,
            conflict_pairs: null,
            cooccurrence_perball: null,
            cooccurrence_byissues: null
        };

        // 相克对预计算（如果启用）
        if (task.exclusion_conditions?.conflictPairs?.enabled) {
            issueData.conflict_pairs = await precomputeConflictPairs(
                targetIssue,
                task.exclusion_conditions.conflictPairs
            );
        }

        // 同出（按红球）预计算（如果启用）
        if (task.exclusion_conditions?.coOccurrencePerBall?.enabled) {
            issueData.cooccurrence_perball = await precomputeCooccurrencePerBall(
                targetIssue,
                task.exclusion_conditions.coOccurrencePerBall
            );
        }

        // 同出（按期号）预计算（如果启用）
        if (task.exclusion_conditions?.coOccurrenceByIssues?.enabled) {
            issueData.cooccurrence_byissues = await precomputeCooccurrenceByIssues(
                targetIssue,
                task.exclusion_conditions.coOccurrenceByIssues
            );
        }

        precomputedData.push(issueData);
    }

    const totalTime = Date.now() - startTime;

    // 保存预计算结果
    task.precomputed_exclusions = precomputedData;
    task.precompute_stats = {
        total_issues: targetIssues.length,
        computed_issues: precomputedData.length,
        total_time_ms: totalTime,
        avg_time_per_issue_ms: Math.round(totalTime / precomputedData.length)
    };
    await task.save();

    log(`✅ 预计算完成 - 耗时${totalTime}ms, 平均${task.precompute_stats.avg_time_per_issue_ms}ms/期`);
}
```

##### 3. 预计算函数实现

**相克对预计算**:
```javascript
async function precomputeConflictPairs(targetIssue, config) {
    // 复用现有逻辑，但结果存储而非立即使用
    const { globalTopEnabled, globalAnalysisPeriods, topN, perBallTopEnabled, perBallAnalysisPeriods, perBallTopN, hotProtection } = config;

    const maxPeriods = Math.max(
        globalTopEnabled ? globalAnalysisPeriods : 0,
        perBallTopEnabled ? perBallAnalysisPeriods : 0
    );

    // 1. 查询历史数据
    const targetIssueNum = parseInt(targetIssue);
    const analysisData = await DLT.find({
        Issue: { $lt: targetIssueNum }
    }).sort({ Issue: -1 }).limit(maxPeriods).lean();

    // 2. 统计相克矩阵
    const conflictMatrix = {};
    for (let i = 1; i <= 35; i++) {
        conflictMatrix[i] = {};
        for (let j = 1; j <= 35; j++) {
            if (i !== j) conflictMatrix[i][j] = 0;
        }
    }

    analysisData.forEach(record => {
        const redNumbers = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        for (let appeared = 1; appeared <= 35; appeared++) {
            if (redNumbers.includes(appeared)) {
                for (let notAppeared = 1; notAppeared <= 35; notAppeared++) {
                    if (appeared !== notAppeared && !redNumbers.includes(notAppeared)) {
                        conflictMatrix[appeared][notAppeared]++;
                    }
                }
            }
        }
    });

    // 3. 排序获取TopN
    const conflictScores = [];
    for (let a = 1; a <= 35; a++) {
        for (let b = a + 1; b <= 35; b++) {
            const score = conflictMatrix[a][b] + conflictMatrix[b][a];
            if (score > 0) {
                conflictScores.push([a, b]);  // 只保存对，不保存分数（节省空间）
            }
        }
    }

    conflictScores.sort((x, y) => {
        const scoreX = conflictMatrix[x[0]][x[1]] + conflictMatrix[x[1]][x[0]];
        const scoreY = conflictMatrix[y[0]][y[1]] + conflictMatrix[y[1]][y[0]];
        return scoreY - scoreX;
    });

    const topPairs = conflictScores.slice(0, topN);

    // 4. 统计热号（如果启用）
    let hotNumbers = [];
    if (hotProtection && hotProtection.enabled) {
        const hotCounts = {};
        for (let num = 1; num <= 35; num++) hotCounts[num] = 0;

        const hotAnalysisData = analysisData.slice(0, perBallAnalysisPeriods || maxPeriods);
        hotAnalysisData.forEach(record => {
            [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(num => {
                if (num >= 1 && num <= 35) hotCounts[num]++;
            });
        });

        const sortedHot = Object.entries(hotCounts)
            .map(([num, count]) => ({ num: parseInt(num), count }))
            .sort((a, b) => b.count - a.count);

        hotNumbers = sortedHot.slice(0, hotProtection.topHotCount).map(h => h.num);
    }

    return {
        pairs: topPairs,
        hot_numbers: hotNumbers,
        analysis_periods: maxPeriods,
        topN: topN
    };
}
```

**同出（按红球）预计算**:
```javascript
async function precomputeCooccurrencePerBall(targetIssue, config) {
    const { periods, combo2, combo3, combo4 } = config;

    // 1. 调用同出API
    const url = `http://localhost:3003/api/dlt/cooccurrence-per-ball?targetIssue=${targetIssue}&periods=${periods}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.success || !result.data) {
        return {
            exclude_features: { combo_2: [], combo_3: [], combo_4: [] },
            analyzed_balls: [],
            periods: periods
        };
    }

    const analyzedDetailsObj = result.data.analyzedDetails || {};
    const analyzedDetails = Object.values(analyzedDetailsObj);

    // 2. 提取涉及期号
    const allIssues = new Set();
    analyzedDetails.forEach(detail => {
        if (detail.lastAppearedIssue) {
            allIssues.add(detail.lastAppearedIssue);
        }
    });

    // 3. 查询组合特征
    const features = await DLTComboFeatures.find({
        Issue: { $in: Array.from(allIssues) }
    }).lean();

    // 4. 聚合特征
    const excludeFeatures = {
        combo_2: new Set(),
        combo_3: new Set(),
        combo_4: new Set()
    };

    features.forEach(record => {
        if (combo2 && record.combo_2) {
            record.combo_2.forEach(f => excludeFeatures.combo_2.add(f));
        }
        if (combo3 && record.combo_3) {
            record.combo_3.forEach(f => excludeFeatures.combo_3.add(f));
        }
        if (combo4 && record.combo_4) {
            record.combo_4.forEach(f => excludeFeatures.combo_4.add(f));
        }
    });

    return {
        exclude_features: {
            combo_2: Array.from(excludeFeatures.combo_2),
            combo_3: Array.from(excludeFeatures.combo_3),
            combo_4: Array.from(excludeFeatures.combo_4)
        },
        analyzed_balls: analyzedDetails.map(d => d.ballNumber),
        periods: periods
    };
}
```

**同出（按期号）预计算**:
```javascript
async function precomputeCooccurrenceByIssues(targetIssue, config) {
    const { periods, combo2, combo3, combo4 } = config;

    // 1. 获取目标期号的ID
    const targetRecord = await DLT.findOne({ Issue: parseInt(targetIssue) }).lean();
    if (!targetRecord) {
        return {
            exclude_features: { combo_2: [], combo_3: [], combo_4: [] },
            analyzed_issues: [],
            periods: periods
        };
    }

    // 2. 获取最近N期
    const startID = targetRecord.ID - periods;
    const recentRecords = await DLT.find({
        ID: { $gte: startID, $lt: targetRecord.ID }
    }).select('ID Issue').sort({ ID: 1 }).lean();

    const recentIDs = recentRecords.map(r => r.ID);
    const analyzedIssues = recentRecords.map(r => String(r.Issue));

    // 3. 查询组合特征
    const features = await DLTComboFeatures.find({
        ID: { $in: recentIDs }
    }).lean();

    // 4. 聚合特征
    const excludeFeatures = {
        combo_2: new Set(),
        combo_3: new Set(),
        combo_4: new Set()
    };

    features.forEach(record => {
        if (combo2 && record.combo_2) {
            record.combo_2.forEach(f => excludeFeatures.combo_2.add(f));
        }
        if (combo3 && record.combo_3) {
            record.combo_3.forEach(f => excludeFeatures.combo_3.add(f));
        }
        if (combo4 && record.combo_4) {
            record.combo_4.forEach(f => excludeFeatures.combo_4.add(f));
        }
    });

    return {
        exclude_features: {
            combo_2: Array.from(excludeFeatures.combo_2),
            combo_3: Array.from(excludeFeatures.combo_3),
            combo_4: Array.from(excludeFeatures.combo_4)
        },
        analyzed_issues: analyzedIssues,
        periods: periods
    };
}
```

##### 4. 运行时读取

**修改 `getConflictPairs`**:
```javascript
async getConflictPairs(targetIssue, conflictConfig) {
    // ⚡ 优先从任务的预计算数据读取
    if (this.taskId) {
        const task = await PredictionTask.findById(this.taskId).lean();
        if (task && task.precomputed_exclusions) {
            const precomputed = task.precomputed_exclusions.find(
                p => p.target_issue === targetIssue
            );

            if (precomputed && precomputed.conflict_pairs) {
                log(`⚡ [${this.sessionId}] 从预计算数据读取相克对`);
                return precomputed.conflict_pairs.pairs || [];
            }
        }
    }

    // ⚠️ 回退：实时计算（向后兼容）
    log(`⚠️ [${this.sessionId}] 未找到预计算数据，实时计算相克对`);
    // ... 现有逻辑 ...
}
```

**修改 `getExcludeComboFeaturesPerBall`**:
```javascript
async getExcludeComboFeaturesPerBall(targetIssue, periods, options) {
    // ⚡ 优先从预计算数据读取
    if (this.taskId) {
        const task = await PredictionTask.findById(this.taskId).lean();
        if (task && task.precomputed_exclusions) {
            const precomputed = task.precomputed_exclusions.find(
                p => p.target_issue === targetIssue
            );

            if (precomputed && precomputed.cooccurrence_perball) {
                log(`⚡ [${this.sessionId}] 从预计算数据读取同出特征(按红球)`);
                return {
                    excludeFeatures: {
                        combo_2: new Set(precomputed.cooccurrence_perball.exclude_features.combo_2),
                        combo_3: new Set(precomputed.cooccurrence_perball.exclude_features.combo_3),
                        combo_4: new Set(precomputed.cooccurrence_perball.exclude_features.combo_4)
                    },
                    analyzedDetails: [],
                    sampleFeatures: []
                };
            }
        }
    }

    // ⚠️ 回退：实时计算
    log(`⚠️ [${this.sessionId}] 未找到预计算数据，实时计算同出特征`);
    // ... 现有逻辑 ...
}
```

---

### 方案B：全局预计算表（不推荐）

**思路**: 创建独立的预计算表，存储所有可能的期号×配置组合

**问题**:
- ❌ 配置参数太多（分析期数、TopN、热号保护等），组合爆炸
- ❌ 数据量巨大（25000期 × N种配置 = 几百万条记录）
- ❌ 配置变化时需要重新计算
- ❌ 维护成本高

**结论**: 不推荐

---

### 方案C：混合缓存策略（可选补充）

在方案A基础上，增加全局缓存层：

```javascript
// 内存缓存（LRU，容量1000条）
const precomputeCache = new Map();

async function precomputeConflictPairs(targetIssue, config) {
    const cacheKey = `conflict_${targetIssue}_${JSON.stringify(config)}`;

    // 检查缓存
    if (precomputeCache.has(cacheKey)) {
        return precomputeCache.get(cacheKey);
    }

    // 计算
    const result = await doPrecomputeConflictPairs(targetIssue, config);

    // 缓存（LRU淘汰）
    if (precomputeCache.size >= 1000) {
        const firstKey = precomputeCache.keys().next().value;
        precomputeCache.delete(firstKey);
    }
    precomputeCache.set(cacheKey, result);

    return result;
}
```

---

## 📊 方案A性能预测

### 时间对比

| 阶段 | 当前方案 | 方案A | 提升 |
|------|---------|-------|------|
| **任务创建** | 0ms | 12,750ms (25.5s) | -25.5s |
| **51期预测 - 相克对** | 15,300ms | 0ms (读取预计算) | +15.3s |
| **51期预测 - 同出(按红球)** | 10,200ms | 0ms (读取预计算) | +10.2s |
| **51期预测 - 同出(按期号)** | 8,500ms | 0ms (读取预计算) | +8.5s |
| **总计** | 34,000ms | 12,750ms | **+21.3s (62%提升)** |

### 空间成本

**每期预计算数据大小**:
- 相克对: ~500 bytes (18对 × 2数字 + 热号列表)
- 同出(按红球): ~5KB (约200个2码特征 + 100个3码 + 50个4码)
- 同出(按期号): ~3KB (约150个2码特征 + 75个3码 + 35个4码)

**51期任务总大小**: 51 × (0.5 + 5 + 3) KB = **433 KB**

**可接受**: 相比任务表其他数据，增加不到1MB

---

## ✅ 方案A优势

1. **性能提升显著**: 62%的时间节省
2. **用户体验优化**:
   - 任务创建后立即返回
   - 预计算在后台进行
   - 预测时直接读取，无等待
3. **数据复用**: 同一任务多次查看/导出时，不需要重新计算
4. **向后兼容**: 保留实时计算作为回退
5. **空间成本低**: 每个任务增加不到1MB
6. **维护简单**: 数据随任务生命周期管理

---

## ⚠️ 方案A注意事项

### 1. 预计算失败处理

```javascript
async function precomputeExclusionsForTask(taskId) {
    try {
        // ... 预计算逻辑 ...
    } catch (error) {
        log(`❌ 预计算失败: ${error.message}`);
        // 任务状态保持pending，运行时会回退到实时计算
    }
}
```

### 2. 并发控制

```javascript
// 限制同时预计算的任务数
const precomputeQueue = new Queue({ concurrency: 2 });

app.post('/api/dlt/prediction-tasks/create', async (req, res) => {
    // ...
    precomputeQueue.add(() => precomputeExclusionsForTask(task._id));
    // ...
});
```

### 3. 进度反馈

```javascript
// 任务Schema新增进度字段
{
    precompute_progress: {
        status: { type: String, enum: ['pending', 'computing', 'completed', 'failed'] },
        current_issue: { type: String },
        completed_count: { type: Number, default: 0 },
        total_count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 }
    }
}

// 前端轮询查询进度
async function checkPrecomputeProgress(taskId) {
    const task = await PredictionTask.findById(taskId);
    return task.precompute_progress;
}
```

---

## 🎯 实施建议

### 阶段1: Schema扩展 ✅
- 扩展 `PredictionTask` Schema
- 添加 `precomputed_exclusions` 和 `precompute_stats` 字段
- 数据库迁移

### 阶段2: 预计算函数 ✅
- 实现 `precomputeConflictPairs`
- 实现 `precomputeCooccurrencePerBall`
- 实现 `precomputeCooccurrenceByIssues`
- 实现 `precomputeExclusionsForTask`

### 阶段3: 任务创建集成 ✅
- 修改任务创建API
- 异步触发预计算
- 添加进度跟踪

### 阶段4: 运行时读取 ✅
- 修改 `getConflictPairs` 优先读取预计算
- 修改 `getExcludeComboFeaturesPerBall` 优先读取预计算
- 修改 `getExcludeComboFeaturesByIssues` 优先读取预计算
- 保留实时计算作为回退

### 阶段5: 测试验证 ✅
- 功能测试：预计算数据正确性
- 性能测试：对比优化前后耗时
- 兼容性测试：回退机制正常工作

---

## 📝 总结

| 指标 | 方案A | 说明 |
|------|-------|------|
| **性能提升** | 62% (21.3s) | 51期任务 |
| **空间成本** | +433KB/任务 | 可接受 |
| **实施难度** | 中等 | 需修改Schema和多个函数 |
| **维护成本** | 低 | 数据随任务管理 |
| **向后兼容** | ✅ | 保留实时计算回退 |
| **推荐度** | ⭐⭐⭐⭐⭐ | 强烈推荐 |

**建议**: 采用方案A，任务级预计算 + 运行时读取，性能与可维护性的最佳平衡。

---

**提案者**: Claude Code
**状态**: 等待确认
**预计工作量**: 2-3小时
