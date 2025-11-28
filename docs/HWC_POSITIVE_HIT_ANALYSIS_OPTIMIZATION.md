# 热温冷正选批量预测 - 命中信息优化方案

## 问题描述

当前热温冷正选批量预测任务完成后，任务卡片和详情页显示的命中信息（红球最高命中、蓝球最高命中、一等奖、二等奖、三等奖、命中率、总奖金）均为0或空，无法正确展示预测结果的命中分析。

### 特别注意
- **一等奖、二等奖是浮动奖金**，需要从已开奖期号的`hit_dlts`集合中获取
- `FirstPrizeAmount`字段存储一等奖奖金（字符串格式，如"1,234,567"）
- `SecondPrizeAmount`字段存储二等奖奖金
- 三等至九等奖是固定奖金

## 问题根源分析

### 1. 缓存数据加载问题

`HwcPositivePredictor`类的`cachedHistoryData`在初始化时可能未正确加载开奖数据，导致`calculateHitAnalysisForIssue`方法无法找到开奖记录。

**代码位置**: `src/server/server.js:15645-15678`

```javascript
async calculateHitAnalysisForIssue(targetIssue, redCombinations, blueCombinations, combinationMode) {
    // 问题点：依赖 cachedHistoryData，但可能为空
    const targetData = this.cachedHistoryData.find(h => h.Issue.toString() === targetIssue.toString());
    if (targetData) {
        // 计算命中分析...
    } else {
        isPredicted = true;  // 被错误标记为推算期
    }
}
```

### 2. enableValidation 参数传递问题

在`processHwcPositiveTask`函数中，`enableValidation`默认为`false`:

**代码位置**: `src/server/server.js:17220`

```javascript
const result = await predictor.streamPredict({
    // ...
    enableValidation: task.output_config?.enableHitAnalysis || false,  // 默认false！
    // ...
});
```

如果任务创建时未明确启用命中分析，将完全跳过命中验证。

### 3. 历史数据缓存格式问题

`cachedHistoryData`可能是Array而非Map，导致查找方式不一致：

- 初始化时使用 `new Map()`
- 查找时使用 `this.cachedHistoryData.find()` (Array方法)

## 解决方案

### 方案一：修复缓存初始化（推荐）

#### 1.1 确保预加载历史数据包含开奖号码和奖金信息

**修改位置**: `HwcPositivePredictor.preloadData()` 方法

```javascript
async preloadData(targetIssues, filters, exclude_conditions) {
    // ... 现有代码 ...

    // 2. 预加载历史开奖数据 (确保包含奖金字段)
    const allIssues = targetIssues.map(i => parseInt(i));
    const historyData = await DLT.find({
        Issue: { $in: allIssues }
    }).select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2 FirstPrizeAmount SecondPrizeAmount DrawDate').lean();

    // 转换为数组格式（供find方法使用）
    this.cachedHistoryData = historyData;
    log(`✅ 预加载历史数据: ${historyData.length}期`);

    // ... 现有代码 ...
}
```

#### 1.2 修复calculateHitAnalysisForIssue方法的数据查找逻辑

**修改位置**: `src/server/server.js:15731`

```javascript
if (enableValidation) {
    // 修复：统一使用数组格式查找
    const targetData = Array.isArray(this.cachedHistoryData)
        ? this.cachedHistoryData.find(h => h.Issue.toString() === targetIssue.toString())
        : this.cachedHistoryData?.get?.(targetIssue.toString());

    if (targetData) {
        // 已开奖，计算命中分析
        const hitInfo = await this.calculateHitAnalysisForIssue(
            targetIssue,
            redCombinations,
            blueCombinations,
            combinationMode
        );
        hitAnalysis = hitInfo.hitAnalysis;
        winningNumbers = hitInfo.winningNumbers;
        isPredicted = false;
    } else {
        isPredicted = true;
    }
}
```

### 方案二：强制启用命中分析

#### 2.1 修改任务创建API默认值

**修改位置**: `src/server/server.js:20558-20575`

```javascript
const task = new HwcPositivePredictionTask({
    task_id,
    task_name: finalTaskName,
    task_type: 'hwc-positive-batch',
    period_range: periodRange,
    positive_selection,
    exclusion_conditions: safeExclusionConditions,
    output_config: {
        pairingMode: output_config?.pairingMode || 'truly-unlimited',
        batchSize: output_config?.batchSize || 50000,
        enableHitAnalysis: true,  // ✅ 强制启用命中分析
        autoExport: output_config?.autoExport || false,
        previewMode: output_config?.previewMode || 'comprehensive',
        includeExclusionDetails: output_config?.includeExclusionDetails || false
    },
    // ...
});
```

#### 2.2 修改processHwcPositiveTask默认行为

**修改位置**: `src/server/server.js:17220`

```javascript
const result = await predictor.streamPredict({
    targetIssues: issue_range,
    filters: {
        positiveSelection: task.positive_selection
    },
    exclude_conditions: task.exclusion_conditions || {},
    maxRedCombinations: 324632,
    maxBlueCombinations: 66,
    enableValidation: true,  // ✅ 强制启用（不依赖配置）
    combination_mode: task.output_config?.pairingMode || 'truly-unlimited'
}, (progress) => {
    // ...
});
```

### 方案三：独立的命中分析补全机制

针对已完成但命中数据为空的任务，提供补全功能。

#### 3.1 新增API: 重新计算命中分析

**新增位置**: `src/server/server.js` (在hwc-positive-tasks API区域)

```javascript
/**
 * 重新计算热温冷正选任务的命中分析
 * POST /api/dlt/hwc-positive-tasks/:task_id/recalculate-hits
 */
app.post('/api/dlt/hwc-positive-tasks/:task_id/recalculate-hits', async (req, res) => {
    try {
        const { task_id } = req.params;
        log(`🔄 重新计算任务 ${task_id} 的命中分析...`);

        // 1. 获取任务和结果
        const task = await HwcPositivePredictionTask.findOne({ task_id }).lean();
        if (!task) {
            return res.status(404).json({ success: false, message: '任务不存在' });
        }

        const results = await HwcPositivePredictionTaskResult.find({ task_id }).lean();
        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, message: '任务结果不存在' });
        }

        // 2. 批量获取开奖数据
        const periods = results.map(r => r.period);
        const winningData = await DLT.find({
            Issue: { $in: periods }
        }).select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2 FirstPrizeAmount SecondPrizeAmount').lean();

        const winningMap = new Map();
        winningData.forEach(w => winningMap.set(w.Issue, w));

        // 3. 逐期重新计算命中分析
        let totalFirstPrize = 0, totalSecondPrize = 0, totalThirdPrize = 0;
        let totalPrizeAmount = 0;
        let totalHitRateSum = 0;
        let validPeriodCount = 0;

        for (const result of results) {
            const winning = winningMap.get(result.period);
            if (!winning || result.is_predicted) {
                continue;  // 跳过推算期
            }

            // 提取开奖号码
            const actualRed = [winning.Red1, winning.Red2, winning.Red3, winning.Red4, winning.Red5];
            const actualBlue = [winning.Blue1, winning.Blue2];

            // 获取浮动奖金
            const firstPrizeAmount = parsePrizeAmount(winning.FirstPrizeAmount) || 10000000;
            const secondPrizeAmount = parsePrizeAmount(winning.SecondPrizeAmount) || 100000;

            // 计算命中（使用paired_combinations）
            const hitAnalysis = calculateHitAnalysisFromPairs(
                result.paired_combinations || [],
                actualRed,
                actualBlue,
                firstPrizeAmount,
                secondPrizeAmount
            );

            // 更新结果记录
            await HwcPositivePredictionTaskResult.updateOne(
                { result_id: result.result_id },
                {
                    $set: {
                        'winning_numbers.red': actualRed,
                        'winning_numbers.blue': actualBlue,
                        hit_analysis: hitAnalysis
                    }
                }
            );

            // 累计统计
            totalFirstPrize += hitAnalysis.prize_stats?.first_prize?.count || 0;
            totalSecondPrize += hitAnalysis.prize_stats?.second_prize?.count || 0;
            totalThirdPrize += hitAnalysis.prize_stats?.third_prize?.count || 0;
            totalPrizeAmount += hitAnalysis.total_prize || 0;
            totalHitRateSum += hitAnalysis.hit_rate || 0;
            validPeriodCount++;
        }

        // 4. 更新任务统计
        const avgHitRate = validPeriodCount > 0 ? totalHitRateSum / validPeriodCount : 0;
        await HwcPositivePredictionTask.updateOne(
            { task_id },
            {
                $set: {
                    'statistics.first_prize_count': totalFirstPrize,
                    'statistics.second_prize_count': totalSecondPrize,
                    'statistics.third_prize_count': totalThirdPrize,
                    'statistics.total_prize_amount': totalPrizeAmount,
                    'statistics.avg_hit_rate': avgHitRate
                }
            }
        );

        log(`✅ 命中分析重新计算完成: ${validPeriodCount}期`);
        res.json({
            success: true,
            message: `成功重新计算${validPeriodCount}期的命中分析`,
            statistics: {
                first_prize_count: totalFirstPrize,
                second_prize_count: totalSecondPrize,
                third_prize_count: totalThirdPrize,
                total_prize_amount: totalPrizeAmount,
                avg_hit_rate: avgHitRate
            }
        });

    } catch (error) {
        log(`❌ 重新计算命中分析失败: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 辅助函数：从配对组合计算命中分析
 */
function calculateHitAnalysisFromPairs(pairedCombinations, actualRed, actualBlue, firstPrizeAmount, secondPrizeAmount) {
    const FIXED_PRIZES = {
        third: 10000,
        fourth: 3000,
        fifth: 300,
        sixth: 200,
        seventh: 100,
        eighth: 15,
        ninth: 5
    };

    const prize_stats = {
        first_prize: { count: 0, amount: 0 },
        second_prize: { count: 0, amount: 0 },
        third_prize: { count: 0, amount: 0 },
        fourth_prize: { count: 0, amount: 0 },
        fifth_prize: { count: 0, amount: 0 },
        sixth_prize: { count: 0, amount: 0 },
        seventh_prize: { count: 0, amount: 0 },
        eighth_prize: { count: 0, amount: 0 },
        ninth_prize: { count: 0, amount: 0 }
    };

    let maxRedHit = 0, maxBlueHit = 0;

    for (const pair of pairedCombinations) {
        const redBalls = pair.red_balls || [];
        const blueBalls = pair.blue_balls || [];

        // 计算命中数
        const redHit = redBalls.filter(n => actualRed.includes(n)).length;
        const blueHit = blueBalls.filter(n => actualBlue.includes(n)).length;

        maxRedHit = Math.max(maxRedHit, redHit);
        maxBlueHit = Math.max(maxBlueHit, blueHit);

        // 判断奖项
        if (redHit === 5 && blueHit === 2) {
            prize_stats.first_prize.count++;
            prize_stats.first_prize.amount += firstPrizeAmount;
        } else if (redHit === 5 && blueHit === 1) {
            prize_stats.second_prize.count++;
            prize_stats.second_prize.amount += secondPrizeAmount;
        } else if (redHit === 5 && blueHit === 0) {
            prize_stats.third_prize.count++;
            prize_stats.third_prize.amount += FIXED_PRIZES.third;
        } else if (redHit === 4 && blueHit === 2) {
            prize_stats.fourth_prize.count++;
            prize_stats.fourth_prize.amount += FIXED_PRIZES.fourth;
        } else if (redHit === 4 && blueHit === 1) {
            prize_stats.fifth_prize.count++;
            prize_stats.fifth_prize.amount += FIXED_PRIZES.fifth;
        } else if (redHit === 3 && blueHit === 2) {
            prize_stats.sixth_prize.count++;
            prize_stats.sixth_prize.amount += FIXED_PRIZES.sixth;
        } else if (redHit === 4 && blueHit === 0) {
            prize_stats.seventh_prize.count++;
            prize_stats.seventh_prize.amount += FIXED_PRIZES.seventh;
        } else if ((redHit === 3 && blueHit === 1) || (redHit === 2 && blueHit === 2)) {
            prize_stats.eighth_prize.count++;
            prize_stats.eighth_prize.amount += FIXED_PRIZES.eighth;
        } else if ((redHit === 3 && blueHit === 0) || (redHit === 1 && blueHit === 2) ||
                   (redHit === 2 && blueHit === 1) || (redHit === 0 && blueHit === 2)) {
            prize_stats.ninth_prize.count++;
            prize_stats.ninth_prize.amount += FIXED_PRIZES.ninth;
        }
    }

    const totalCombinations = pairedCombinations.length;
    const totalWinningCombos = Object.values(prize_stats).reduce((sum, s) => sum + s.count, 0);
    const hitRate = totalCombinations > 0 ? (totalWinningCombos / totalCombinations) * 100 : 0;
    const totalPrize = Object.values(prize_stats).reduce((sum, s) => sum + s.amount, 0);

    return {
        max_red_hit: maxRedHit,
        max_blue_hit: maxBlueHit,
        prize_stats,
        hit_rate: Math.round(hitRate * 100) / 100,
        total_prize: totalPrize
    };
}

/**
 * 辅助函数：解析奖金字符串
 */
function parsePrizeAmount(amountStr) {
    if (!amountStr) return 0;
    const cleaned = amountStr.toString().replace(/,/g, '').replace(/\s/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}
```

#### 3.2 前端添加重新计算按钮

**修改位置**: `src/renderer/dlt-module.js` - `createHwcPosTaskCard`函数

在任务卡片的已完成状态下添加按钮：

```javascript
${task.status === 'completed' ? `
    <button class="btn-primary" onclick="viewHwcPosTaskDetail('${task.task_id}')">📊 查看详情</button>
    <button class="btn-secondary" onclick="recalculateHwcPosHits('${task.task_id}')">🔄 重算命中</button>
` : ''}
```

并添加对应的JS函数：

```javascript
async function recalculateHwcPosHits(taskId) {
    if (!confirm('确定要重新计算此任务的命中分析吗？这可能需要一些时间。')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/dlt/hwc-positive-tasks/${taskId}/recalculate-hits`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            alert(`命中分析重新计算完成！\n一等奖: ${result.statistics.first_prize_count}次\n二等奖: ${result.statistics.second_prize_count}次\n总奖金: ¥${result.statistics.total_prize_amount.toLocaleString()}`);
            loadHwcPosTaskList();  // 刷新列表
        } else {
            alert('重新计算失败: ' + result.message);
        }
    } catch (error) {
        alert('重新计算失败: ' + error.message);
    }
}
```

## 实施计划

### 第一阶段：紧急修复（方案二）
1. 修改任务创建API，强制启用命中分析
2. 修改processHwcPositiveTask，确保enableValidation为true
3. 测试新创建的任务是否正确计算命中

### 第二阶段：根本修复（方案一）
1. 修复HwcPositivePredictor的preloadData方法
2. 统一cachedHistoryData的数据格式（使用数组）
3. 确保历史数据包含FirstPrizeAmount和SecondPrizeAmount

### 第三阶段：补全机制（方案三）
1. 新增重新计算命中分析的API
2. 前端添加重新计算按钮
3. 为已有任务提供命中数据补全能力

## 验证方法

### 1. 创建测试任务
```bash
curl -X POST http://localhost:3003/api/dlt/hwc-positive-tasks/create \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "测试命中分析",
    "period_range": {"type": "recent", "total": 10},
    "positive_selection": {
      "red_hot_warm_cold_ratios": [{"hot": 4, "warm": 1, "cold": 0}]
    },
    "output_config": {
      "enableHitAnalysis": true,
      "pairingMode": "truly-unlimited"
    }
  }'
```

### 2. 检查任务结果
```bash
curl http://localhost:3003/api/dlt/hwc-positive-tasks/{task_id} | jq '.data.period_results[0].hit_analysis'
```

### 3. 检查数据库中的浮动奖金
```bash
# 在MongoDB shell中
db.hit_dlts.findOne({Issue: 25120}, {FirstPrizeAmount: 1, SecondPrizeAmount: 1})
```

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 大量组合计算耗时 | 任务处理变慢 | 使用批量处理，显示进度 |
| 历史任务数据不完整 | 无法补全命中 | 提供重新计算API |
| 浮动奖金字段缺失 | 使用默认值 | 添加默认奖金配置 |

## 文档修订历史

| 日期 | 版本 | 修改内容 |
|------|------|----------|
| 2025-01-xx | v1.0 | 初始版本 |
