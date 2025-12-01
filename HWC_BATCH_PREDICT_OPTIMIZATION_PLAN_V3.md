# 热温冷正选批量预测性能优化方案 V3

## 文档信息
- **创建日期**: 2025-11-28
- **目标**: 将100期批量预测时间从30+分钟降至1-2分钟
- **原则**: 不影响预测结果准确性，保留必要功能

---

## 一、需求确认

### 1. 排除详情保存范围
- **命中红球最多次的N期**（带排除详情保存标志）
- **推算期**（必要，始终保存）
- 所有期号的处理流程保持一致

### 2. 排除详情存储格式
- 保留每个组合的详细排除原因
- 与现有格式一致

### 3. 前端配置入口
- 任务创建时可选择保存范围

### 4. 异步保存
- 任务完成后排除详情后台保存
- 需要有进度显示

---

## 二、实现逻辑

### 2.1 处理流程（保持一致性）

```
┌─────────────────────────────────────────────────────────────────┐
│                    批量预测任务处理流程                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. 预加载阶段                                                  │
│      ├── 加载红球/蓝球组合缓存                                   │
│      ├── 加载热温冷优化表                                        │
│      └── 加载历史开奖数据                                        │
│                                                                 │
│   2. 逐期处理阶段（所有期号处理流程一致）                          │
│      ├── Step1-6: 正选筛选                                       │
│      ├── Step7-10: 排除条件                                      │
│      ├── 命中分析（已开奖期）                                     │
│      ├── 保存结果到 HwcPositivePredictionTaskResult              │
│      └── 收集排除详情到内存（暂不保存）                           │
│                                                                 │
│   3. 任务完成阶段                                                │
│      ├── 更新任务状态为 completed                                │
│      ├── 计算命中排名，确定需保存排除详情的期号                    │
│      └── 通知前端任务完成                                        │
│                                                                 │
│   4. 异步保存排除详情阶段（后台进行）                             │
│      ├── 按命中排名筛选期号                                      │
│      ├── 逐期保存排除详情                                        │
│      ├── 实时更新保存进度                                        │
│      └── 通过Socket.IO推送进度                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 命中红球排名逻辑

```javascript
/**
 * 计算需要保存排除详情的期号
 * @param {Array} results - 所有期号的处理结果
 * @param {Object} config - 排除详情保存配置
 * @returns {Set<string>} - 需要保存排除详情的期号集合
 */
function determinePeriodsToSaveDetails(results, config) {
    const periodsToSave = new Set();

    // 1. 推算期始终保存
    results.filter(r => r.is_predicted).forEach(r => {
        periodsToSave.add(r.target_issue);
    });

    // 2. 如果配置为"不保存"，只返回推算期
    if (!config.enabled || config.mode === 'none') {
        return periodsToSave;
    }

    // 3. 根据配置模式确定其他期号
    const drawnPeriods = results.filter(r => !r.is_predicted && r.hit_analysis);

    if (config.mode === 'top_hit') {
        // 按命中红球数排序，取前N期
        const sortedByHit = drawnPeriods.sort((a, b) => {
            const hitA = a.hit_analysis?.max_red_hit || 0;
            const hitB = b.hit_analysis?.max_red_hit || 0;
            return hitB - hitA;  // 降序
        });

        const topN = config.top_hit_count || 10;
        for (let i = 0; i < Math.min(topN, sortedByHit.length); i++) {
            periodsToSave.add(sortedByHit[i].target_issue);
        }

    } else if (config.mode === 'recent') {
        // 最近N期
        const sortedByIssue = drawnPeriods.sort((a, b) => {
            return parseInt(b.target_issue) - parseInt(a.target_issue);
        });

        const recentN = config.recent_count || 10;
        for (let i = 0; i < Math.min(recentN, sortedByIssue.length); i++) {
            periodsToSave.add(sortedByIssue[i].target_issue);
        }

    } else if (config.mode === 'all') {
        // 全部保存（不推荐大规模任务）
        results.forEach(r => periodsToSave.add(r.target_issue));
    }

    return periodsToSave;
}
```

### 2.3 排除详情保存进度跟踪

```javascript
/**
 * 异步保存排除详情，实时推送进度
 */
async function saveExclusionDetailsAsync(taskId, periodsToSave, allResults, io) {
    // 1. 更新任务排除详情状态
    await HwcPositivePredictionTask.updateOne(
        { task_id: taskId },
        {
            $set: {
                exclusion_details_status: 'saving',
                exclusion_details_progress: {
                    current: 0,
                    total: periodsToSave.size,
                    percentage: 0,
                    current_period: null
                },
                exclusion_details_periods: Array.from(periodsToSave)
            }
        }
    );

    // 2. 通知前端开始保存
    io.emit('hwc-exclusion-details-started', {
        task_id: taskId,
        total_periods: periodsToSave.size,
        periods: Array.from(periodsToSave)
    });

    // 3. 逐期保存
    let savedCount = 0;
    const errors = [];

    for (const period of periodsToSave) {
        const result = allResults.find(r => r.target_issue === period);
        if (!result || !result.exclusions_to_save?.length) {
            savedCount++;
            continue;
        }

        try {
            // 保存该期的排除详情
            await saveExclusionDetailsBatch(
                taskId,
                `${taskId}-${period}`,
                period,
                result.exclusions_to_save
            );

            savedCount++;

            // 更新进度
            const percentage = Math.round((savedCount / periodsToSave.size) * 100);
            await HwcPositivePredictionTask.updateOne(
                { task_id: taskId },
                {
                    $set: {
                        'exclusion_details_progress.current': savedCount,
                        'exclusion_details_progress.percentage': percentage,
                        'exclusion_details_progress.current_period': period
                    }
                }
            );

            // 推送进度
            io.emit('hwc-exclusion-details-progress', {
                task_id: taskId,
                current: savedCount,
                total: periodsToSave.size,
                percentage: percentage,
                current_period: period,
                message: `正在保存期号 ${period} 的排除详情 (${savedCount}/${periodsToSave.size})`
            });

        } catch (error) {
            errors.push({ period, error: error.message });
            console.log(`⚠️ 期号${period}排除详情保存失败: ${error.message}`);
        }
    }

    // 4. 更新最终状态
    const finalStatus = errors.length === 0 ? 'completed' : 'partial';
    await HwcPositivePredictionTask.updateOne(
        { task_id: taskId },
        {
            $set: {
                exclusion_details_status: finalStatus,
                'exclusion_details_progress.percentage': 100,
                exclusion_details_errors: errors.length > 0 ? errors : undefined
            }
        }
    );

    // 5. 通知前端完成
    io.emit('hwc-exclusion-details-completed', {
        task_id: taskId,
        status: finalStatus,
        saved_count: savedCount,
        error_count: errors.length,
        message: errors.length === 0
            ? `排除详情保存完成 (${savedCount}期)`
            : `排除详情保存完成，${errors.length}期失败`
    });
}
```

---

## 三、数据库Schema调整

### 3.1 HwcPositivePredictionTask 新增字段

```javascript
// 任务Schema新增字段
{
    // ... 现有字段 ...

    // 排除详情保存配置
    exclusion_details_config: {
        enabled: { type: Boolean, default: true },
        mode: {
            type: String,
            enum: ['none', 'top_hit', 'recent', 'all'],
            default: 'top_hit'
        },
        top_hit_count: { type: Number, default: 10 },   // top_hit模式下保存前N期
        recent_count: { type: Number, default: 10 }     // recent模式下保存最近N期
    },

    // 排除详情保存状态
    exclusion_details_status: {
        type: String,
        enum: ['pending', 'saving', 'completed', 'partial', 'failed', 'skipped'],
        default: 'pending'
    },

    // 排除详情保存进度
    exclusion_details_progress: {
        current: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        current_period: { type: String }
    },

    // 需要保存排除详情的期号列表
    exclusion_details_periods: [{ type: String }],

    // 保存失败的错误信息
    exclusion_details_errors: [{
        period: String,
        error: String
    }]
}
```

### 3.2 HwcPositivePredictionTaskResult 新增字段

```javascript
// 结果Schema新增字段
{
    // ... 现有字段 ...

    // 是否保存了排除详情
    has_exclusion_details: { type: Boolean, default: false },

    // 命中排名（用于筛选保存排除详情的期号）
    hit_rank: { type: Number }
}
```

---

## 四、前端配置界面

### 4.1 任务创建表单新增选项

```html
<!-- 排除详情保存配置 -->
<div class="form-section">
    <h4>排除详情保存设置</h4>

    <div class="form-group">
        <label>
            <input type="checkbox" id="exclusion-details-enabled" checked>
            保存排除详情
        </label>
    </div>

    <div class="form-group" id="exclusion-details-mode-group">
        <label>保存范围：</label>
        <select id="exclusion-details-mode">
            <option value="top_hit" selected>命中红球最多的N期 + 推算期</option>
            <option value="recent">最近N期 + 推算期</option>
            <option value="all">全部期号（不推荐大规模任务）</option>
            <option value="none">仅推算期</option>
        </select>
    </div>

    <div class="form-group" id="exclusion-details-count-group">
        <label>保存期数：</label>
        <input type="number" id="exclusion-details-count" value="10" min="1" max="100">
        <span class="hint">除推算期外，额外保存的期数</span>
    </div>
</div>
```

### 4.2 任务详情页进度显示

```html
<!-- 任务状态显示 -->
<div class="task-status">
    <div class="status-item">
        <span class="label">预测状态：</span>
        <span class="value status-completed">✅ 已完成</span>
    </div>

    <div class="status-item" id="exclusion-details-status">
        <span class="label">排除详情保存：</span>
        <span class="value status-saving">
            ⏳ 保存中 (15/20期, 75%)
        </span>
        <div class="progress-bar">
            <div class="progress-fill" style="width: 75%"></div>
        </div>
        <span class="current-period">当前：25120期</span>
    </div>
</div>
```

---

## 五、Socket.IO事件定义

### 5.1 新增事件

| 事件名 | 方向 | 触发时机 | 数据结构 |
|--------|------|---------|---------|
| `hwc-exclusion-details-started` | Server→Client | 开始保存排除详情 | `{task_id, total_periods, periods[]}` |
| `hwc-exclusion-details-progress` | Server→Client | 保存进度更新 | `{task_id, current, total, percentage, current_period, message}` |
| `hwc-exclusion-details-completed` | Server→Client | 保存完成 | `{task_id, status, saved_count, error_count, message}` |

### 5.2 前端监听示例

```javascript
// 监听排除详情保存事件
socket.on('hwc-exclusion-details-started', (data) => {
    console.log(`开始保存排除详情: ${data.total_periods}期`);
    updateExclusionDetailsUI('saving', 0, data.total_periods);
});

socket.on('hwc-exclusion-details-progress', (data) => {
    updateExclusionDetailsUI('saving', data.current, data.total, data.current_period);
});

socket.on('hwc-exclusion-details-completed', (data) => {
    if (data.status === 'completed') {
        updateExclusionDetailsUI('completed', data.saved_count, data.saved_count);
        showToast(`排除详情保存完成 (${data.saved_count}期)`);
    } else {
        updateExclusionDetailsUI('partial', data.saved_count, data.saved_count + data.error_count);
        showToast(`排除详情保存完成，${data.error_count}期失败`, 'warning');
    }
});
```

---

## 六、API调整

### 6.1 任务创建API

**请求参数新增**：
```json
{
    "task_name": "热温冷正选_2025-11-28",
    "period_range": { ... },
    "positive_selection": { ... },
    "exclusion_conditions": { ... },
    "output_config": {
        "pairingMode": "unlimited",
        "enableHitAnalysis": true,
        "exclusion_details": {                    // 新增
            "enabled": true,
            "mode": "top_hit",
            "top_hit_count": 10
        }
    }
}
```

### 6.2 任务详情API

**响应新增字段**：
```json
{
    "success": true,
    "data": {
        "task_id": "hwc-pos-xxx",
        "status": "completed",
        // ... 现有字段 ...

        "exclusion_details_status": "saving",     // 新增
        "exclusion_details_progress": {           // 新增
            "current": 5,
            "total": 11,
            "percentage": 45,
            "current_period": "25118"
        },
        "exclusion_details_periods": ["25115", "25116", ...],  // 新增
        "exclusion_details_config": {             // 新增
            "enabled": true,
            "mode": "top_hit",
            "top_hit_count": 10
        }
    }
}
```

---

## 七、实施计划

### 阶段1：后端核心修改（预计1.5小时）

| 步骤 | 文件 | 修改内容 |
|------|------|---------|
| 1 | server.js | Schema新增字段 |
| 2 | server.js | processHwcPositiveTask() 重构 |
| 3 | server.js | 新增 determinePeriodsToSaveDetails() |
| 4 | server.js | 新增 saveExclusionDetailsAsync() |
| 5 | server.js | Socket.IO事件发送 |
| 6 | server.js | 任务创建API支持新配置 |

### 阶段2：前端适配（预计1小时）

| 步骤 | 文件 | 修改内容 |
|------|------|---------|
| 1 | dlt-module.js | 任务创建表单新增配置项 |
| 2 | dlt-module.js | Socket.IO事件监听 |
| 3 | dlt-module.js | 任务详情页进度显示 |

### 阶段3：测试验证（预计0.5小时）

1. 10期任务测试（验证基本功能）
2. 50期任务测试（验证性能）
3. 100期任务测试（验证稳定性）

---

## 八、预期效果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| 101期任务完成时间 | 30+分钟（卡死） | **~30秒** |
| 任务状态更新 | 卡死 | **立即** |
| 排除详情保存 | 阻塞主流程 | **后台异步** |
| 排除详情保存时间 | - | 约1-2分钟（11期） |
| 用户体验 | 无反馈 | **实时进度** |

---

## 九、确认清单

请确认以下内容：

### 逻辑确认
- [ ] 命中红球排名：按 `hit_analysis.max_red_hit` 降序排列取前N期
- [ ] 推算期始终保存排除详情
- [ ] 默认保存"命中红球最多的10期 + 推算期"

### 配置选项确认
- [ ] 模式选项：top_hit / recent / all / none
- [ ] 默认模式：top_hit
- [ ] 默认数量：10期

### 进度显示确认
- [ ] 任务详情页显示排除详情保存进度
- [ ] 使用Socket.IO实时推送进度
- [ ] 进度格式：当前期数/总期数，百分比，当前期号

### 兼容性确认
- [ ] 现有任务结果格式不变
- [ ] 排除详情存储格式不变
- [ ] 前端现有功能不受影响

---

**请确认后我将开始实施。**
