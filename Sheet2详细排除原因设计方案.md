# Sheet 2 详细排除原因设计方案

## 一、需求明确

### 当前问题
Sheet 2 的"排除原因"列只显示通用描述：
- ❌ "包含相克号码对"（不知道具体是哪一对）
- ❌ "高频号过多"（不知道具体是哪些号）

### 目标效果
显示具体详细的排除原因：
- ✅ "包含相克对: 02-27, 15-33"（显示所有相克对）
- ✅ "包含3个高频号: 03, 07, 12"（显示所有高频号）
- ✅ "连号组数=0（无连号）"
- ✅ "最长连号=5连号（01-02-03-04-05）"

---

## 二、技术实现方案

### 2.1 方案A：在DLTExclusionDetails中扩展存储（推荐）⭐

#### 优点
- ✅ 数据持久化，可追溯
- ✅ 支持后续查询和分析
- ✅ 灵活扩展

#### Schema扩展

**当前Schema**（1017-1045行）：
```javascript
const dltExclusionDetailsSchema = new mongoose.Schema({
    task_id: { type: String, required: true, index: true },
    result_id: { type: String, required: true, index: true },
    period: { type: String, required: true, index: true },
    step: { type: Number, required: true },
    condition: { type: String, required: true },

    excluded_combination_ids: [{ type: Number }],
    excluded_count: { type: Number, required: true },

    is_partial: { type: Boolean, default: false },
    chunk_index: { type: Number },
    total_chunks: { type: Number },

    created_at: { type: Date, default: Date.now, index: true }
});
```

**扩展后Schema**：
```javascript
const dltExclusionDetailsSchema = new mongoose.Schema({
    task_id: { type: String, required: true, index: true },
    result_id: { type: String, required: true, index: true },
    period: { type: String, required: true, index: true },
    step: { type: Number, required: true },
    condition: { type: String, required: true },

    excluded_combination_ids: [{ type: Number }],
    excluded_count: { type: Number, required: true },

    // ⭐ 新增：详细排除原因映射
    exclusion_details_map: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // 格式示例：
    // {
    //   "12345": {  // combination_id
    //     "conflict_pairs": ["02-27", "15-33"],
    //     "hot_numbers": [3, 7, 12],
    //     "consecutive_info": { groups: 0, max_length: 0 }
    //   }
    // }

    is_partial: { type: Boolean, default: false },
    chunk_index: { type: Number },
    total_chunks: { type: Number },

    created_at: { type: Date, default: Date.now, index: true }
});
```

---

### 2.2 方案B：导出时实时计算（备选）

#### 优点
- ✅ 无需修改Schema
- ✅ 实施更快

#### 缺点
- ❌ 每次导出都要重新计算
- ❌ 性能稍差（需重新查询历史数据）

---

## 三、推荐实施：方案A

### 3.1 修改保存逻辑

#### saveExclusionDetails 函数扩展

**当前函数**（20642-20687行）：
```javascript
async function saveExclusionDetails(task_id, result_id, period, step, condition, excludedIds) {
    // ... 现有逻辑 ...
}
```

**扩展为**：
```javascript
/**
 * 保存排除详情（带详细原因）
 * @param {String} task_id
 * @param {String} result_id
 * @param {String} period
 * @param {Number} step
 * @param {String} condition
 * @param {Array<Number>} excludedIds
 * @param {Object} detailsMap - 详细原因映射 { comboId: { reason details } }
 */
async function saveExclusionDetails(task_id, result_id, period, step, condition, excludedIds, detailsMap = {}) {
    if (!excludedIds || excludedIds.length === 0) {
        return;
    }

    const CHUNK_SIZE = 50000;

    try {
        if (excludedIds.length <= CHUNK_SIZE) {
            // 单个文档保存
            await DLTExclusionDetails.create({
                task_id,
                result_id,
                period: period.toString(),
                step,
                condition,
                excluded_combination_ids: excludedIds,
                excluded_count: excludedIds.length,
                exclusion_details_map: detailsMap,  // ⭐ 新增
                is_partial: false
            });
        } else {
            // 分片保存
            const totalChunks = Math.ceil(excludedIds.length / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                const chunkIds = excludedIds.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

                // 为分片提取对应的详细原因
                const chunkDetailsMap = {};
                for (const id of chunkIds) {
                    if (detailsMap[id]) {
                        chunkDetailsMap[id] = detailsMap[id];
                    }
                }

                await DLTExclusionDetails.create({
                    task_id,
                    result_id,
                    period: period.toString(),
                    step,
                    condition,
                    excluded_combination_ids: chunkIds,
                    excluded_count: chunkIds.length,
                    exclusion_details_map: chunkDetailsMap,  // ⭐ 新增
                    is_partial: true,
                    chunk_index: i,
                    total_chunks: totalChunks
                });
            }
        }

        log(`    💾 Step ${step} 排除详情已保存: ${excludedIds.length} 个组合（含详细原因）`);
    } catch (error) {
        log(`    ⚠️ 保存排除详情失败 (Step ${step}): ${error.message}`);
    }
}
```

---

### 3.2 各排除条件的详细原因记录

#### 3.2.1 连号组数排除（Step 7）

```javascript
// ⭐ 5.1 连号组数排除
if (exclusion_conditions?.consecutiveGroups?.enabled) {
    const { groups } = exclusion_conditions.consecutiveGroups;

    if (groups && groups.length > 0) {
        log(`  🔢 应用连号组数排除: 排除 ${groups.join(', ')} 组`);

        const beforeIds = combinations.map(c => c.combination_id);
        const detailsMap = {};  // ⭐ 新增：详细原因映射

        // 过滤并记录详细原因
        combinations = combinations.filter(combo => {
            let consecutiveGroups;
            if (combo.consecutive_groups !== undefined && combo.consecutive_groups !== null) {
                consecutiveGroups = combo.consecutive_groups;
            } else {
                const redBalls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
                const analysis = analyzeConsecutive(redBalls);
                consecutiveGroups = analysis.consecutiveGroups;
            }

            // 检查是否要排除
            if (groups.includes(consecutiveGroups)) {
                // ⭐ 记录详细原因
                detailsMap[combo.combination_id] = {
                    consecutive_groups: consecutiveGroups,
                    description: consecutiveGroups === 0 ? '无连号' : `${consecutiveGroups}组连号`
                };
                return false;  // 排除
            }
            return true;  // 保留
        });

        const afterIds = combinations.map(c => c.combination_id);
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 7,
                condition: 'exclusion_consecutive_groups',
                excludedIds: excludedIds,
                detailsMap: detailsMap  // ⭐ 传递详细原因
            });
        }

        log(`  🔢 连号组数排除后: ${combinations.length} 个组合 (排除${excludedIds.length}个)`);
    }
}
```

#### 3.2.2 最长连号长度排除（Step 8）

```javascript
// ⭐ 5.2 最长连号长度排除
if (exclusion_conditions?.maxConsecutiveLength?.enabled) {
    const { lengths } = exclusion_conditions.maxConsecutiveLength;

    if (lengths && lengths.length > 0) {
        log(`  📏 应用最长连号长度排除: 排除 ${lengths.join(', ')}`);

        const beforeIds = combinations.map(c => c.combination_id);
        const detailsMap = {};  // ⭐ 新增

        combinations = combinations.filter(combo => {
            let maxConsecutiveLength;
            let consecutiveNumbers = [];  // 记录连号

            if (combo.max_consecutive_length !== undefined && combo.max_consecutive_length !== null) {
                maxConsecutiveLength = combo.max_consecutive_length;
            } else {
                const redBalls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
                const analysis = analyzeConsecutive(redBalls);
                maxConsecutiveLength = analysis.maxConsecutiveLength;

                // ⭐ 提取连号序列（用于显示）
                const sorted = [...redBalls].sort((a, b) => a - b);
                let tempSeq = [sorted[0]];
                for (let i = 1; i < sorted.length; i++) {
                    if (sorted[i] - sorted[i-1] === 1) {
                        tempSeq.push(sorted[i]);
                        if (tempSeq.length === maxConsecutiveLength) {
                            consecutiveNumbers = tempSeq;
                        }
                    } else {
                        tempSeq = [sorted[i]];
                    }
                }
            }

            if (lengths.includes(maxConsecutiveLength)) {
                // ⭐ 记录详细原因
                const desc = maxConsecutiveLength === 0 ? '无连号' :
                           maxConsecutiveLength === 5 ? `5连号全连(${consecutiveNumbers.map(n => String(n).padStart(2,'0')).join('-')})` :
                           `最长${maxConsecutiveLength}连号(${consecutiveNumbers.map(n => String(n).padStart(2,'0')).join('-')})`;

                detailsMap[combo.combination_id] = {
                    max_consecutive_length: maxConsecutiveLength,
                    consecutive_numbers: consecutiveNumbers,
                    description: desc
                };
                return false;
            }
            return true;
        });

        const afterIds = combinations.map(c => c.combination_id);
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 8,
                condition: 'exclusion_max_consecutive_length',
                excludedIds: excludedIds,
                detailsMap: detailsMap  // ⭐ 传递详细原因
            });
        }

        log(`  📏 最长连号长度排除后: ${combinations.length} 个组合 (排除${excludedIds.length}个)`);
    }
}
```

#### 3.2.3 相克对排除（Step 9）

```javascript
// ⭐ 5.3 相克对排除
if (exclusion_conditions?.conflictPairs?.enabled) {
    log(`  ⚔️ 应用相克对排除...`);

    const beforeIds = combinations.map(c => c.combination_id);
    const detailsMap = {};  // ⭐ 新增

    // 构建相克对Set
    const conflictPairsSet = new Set();
    const recentIssues = await DLT.find({}).sort({ Issue: -1 }).limit(50).lean();

    const pairCounts = new Map();
    for (const issue of recentIssues) {
        const reds = issue.Red || [];
        for (let i = 0; i < reds.length - 1; i++) {
            for (let j = i + 1; j < reds.length; j++) {
                const key = reds[i] < reds[j] ? `${reds[i]}-${reds[j]}` : `${reds[j]}-${reds[i]}`;
                pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
            }
        }
    }

    const threshold = 2;
    for (const [pair, count] of pairCounts) {
        if (count <= threshold) {
            conflictPairsSet.add(pair);
        }
    }

    log(`  ⚔️ 识别到 ${conflictPairsSet.size} 对相克号码`);

    // 过滤并记录详细原因
    combinations = combinations.filter(combo => {
        const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
        const foundConflicts = [];  // ⭐ 记录找到的相克对

        for (let i = 0; i < balls.length - 1; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const key = balls[i] < balls[j] ? `${balls[i]}-${balls[j]}` : `${balls[j]}-${balls[i]}`;
                if (conflictPairsSet.has(key)) {
                    // ⭐ 格式化为 "02-27" 格式
                    const [n1, n2] = key.split('-').map(Number);
                    foundConflicts.push(`${String(n1).padStart(2,'0')}-${String(n2).padStart(2,'0')}`);
                }
            }
        }

        if (foundConflicts.length > 0) {
            // ⭐ 记录详细原因
            detailsMap[combo.combination_id] = {
                conflict_pairs: foundConflicts,
                description: `包含相克对: ${foundConflicts.join(', ')}`
            };
            return false;  // 排除
        }
        return true;  // 保留
    });

    const afterIds = combinations.map(c => c.combination_id);
    const afterIdSet = new Set(afterIds);
    const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

    if (excludedIds.length > 0) {
        exclusionsToSave.push({
            step: 9,
            condition: 'exclusion_conflict_pairs',
            excludedIds: excludedIds,
            detailsMap: detailsMap  // ⭐ 传递详细原因
        });
    }

    log(`  ⚔️ 相克对排除后: ${combinations.length} 个组合 (排除${excludedIds.length}个)`);
}
```

#### 3.2.4 同现比排除（Step 10）

```javascript
// ⭐ 5.4 同现比排除
if (exclusion_conditions?.coOccurrence?.enabled) {
    log(`  🔗 应用同现比排除...`);

    const beforeIds = combinations.map(c => c.combination_id);
    const detailsMap = {};  // ⭐ 新增

    const previousIssue = parseInt(targetIssue) - 1;
    const missingRecord = await mongoose.connection.db
        .collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({ Issue: previousIssue.toString() });

    if (missingRecord) {
        // 找出高频号（遗漏值 <= 5）
        const hotNumbers = [];
        for (let i = 1; i <= 35; i++) {
            const missing = missingRecord[`RedBall_${String(i).padStart(2, '0')}`];
            if (missing !== undefined && missing <= 5) {
                hotNumbers.push(i);
            }
        }

        log(`  🔗 识别到 ${hotNumbers.length} 个高频号: ${hotNumbers.join(', ')}`);

        // 过滤并记录详细原因
        combinations = combinations.filter(combo => {
            const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
            const foundHotNumbers = [];  // ⭐ 记录组合中的高频号

            for (const ball of balls) {
                if (hotNumbers.includes(ball)) {
                    foundHotNumbers.push(ball);
                }
            }

            if (foundHotNumbers.length >= 3) {
                // ⭐ 记录详细原因
                detailsMap[combo.combination_id] = {
                    hot_numbers: foundHotNumbers,
                    hot_count: foundHotNumbers.length,
                    description: `包含${foundHotNumbers.length}个高频号: ${foundHotNumbers.map(n => String(n).padStart(2,'0')).join(', ')}`
                };
                return false;  // 排除
            }
            return true;  // 保留
        });

        const afterIds = combinations.map(c => c.combination_id);
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 10,
                condition: 'exclusion_co_occurrence',
                excludedIds: excludedIds,
                detailsMap: detailsMap  // ⭐ 传递详细原因
            });
        }

        log(`  🔗 同现比排除后: ${combinations.length} 个组合 (排除${excludedIds.length}个)`);
    } else {
        log(`  ⚠️ 未找到前一期 ${previousIssue} 的遗漏值数据，跳过同现比排除`);
    }
}
```

---

### 3.3 保存时传递详细原因

**修改保存调用**（21245-21261行）：

```javascript
// ⭐ 异步后台保存排除详情（带详细原因）
if (exclusionsToSave.length > 0) {
    Promise.all(
        exclusionsToSave.map(exclusion =>
            saveExclusionDetails(
                task_id,
                result_id,
                targetIssue,
                exclusion.step,
                exclusion.condition,
                exclusion.excludedIds,
                exclusion.detailsMap  // ⭐ 传递详细原因映射
            )
        )
    ).catch(err => {
        log(`⚠️ 保存排除详情失败: ${err.message}`);
    });
}
```

---

### 3.4 Sheet 2 导出时读取详细原因

**修改Sheet 2生成逻辑**（20274-20319行）：

```javascript
// ===== Sheet 2: 红球排除详情表 =====
log(`  📋 生成 Sheet 2: 红球排除详情表...`);
const sheet2 = workbook.addWorksheet('红球排除详情');

// ... 列定义（同之前）...

// 1. 查询排除详情（Step 7-10）
const exclusionRecords = await DLTExclusionDetails.find({
    task_id,
    period: period.toString(),
    step: { $in: [7, 8, 9, 10] }
}).sort({ step: 1, chunk_index: 1 }).lean();

// 2. 按步骤分组并合并详细原因
const excludedByStep = {};
for (const record of exclusionRecords) {
    if (!excludedByStep[record.step]) {
        excludedByStep[record.step] = {
            condition: record.condition,
            ids: [],
            detailsMap: {}  // ⭐ 合并详细原因
        };
    }
    excludedByStep[record.step].ids.push(...record.excluded_combination_ids);

    // ⭐ 合并详细原因映射
    if (record.exclusion_details_map) {
        Object.assign(excludedByStep[record.step].detailsMap, record.exclusion_details_map);
    }
}

// 3. 查询组合详情
const allExcludedIds = [...new Set(Object.values(excludedByStep).flatMap(s => s.ids))];
const excludedCombos = await DLTRedCombinations.find({
    combination_id: { $in: allExcludedIds }
}).lean();

const comboMap = new Map(excludedCombos.map(c => [c.combination_id, c]));

// 4. 按步骤生成Excel行
for (const step of [7, 8, 9, 10]) {
    const stepData = excludedByStep[step];
    if (!stepData || stepData.ids.length === 0) continue;

    // 添加分组标题行
    const titleRow = sheet2.addRow({
        red1: `=== Step ${step}:`,
        red2: stepNames[step],
        red3: `(排除 ${stepData.ids.length} 个组合)`,
        red4: '==='
    });
    titleRow.font = { bold: true, size: 11 };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    // 添加数据行
    let rowIndex = 0;
    for (const id of stepData.ids) {
        const combo = comboMap.get(id);
        if (!combo) continue;

        // ⭐ 获取该组合的详细排除原因
        const details = stepData.detailsMap[id] || {};
        const detailedReason = details.description || conditionLabels[stepData.condition];

        const dataRow = sheet2.addRow({
            red1: combo.red_ball_1,
            red2: combo.red_ball_2,
            red3: combo.red_ball_3,
            red4: combo.red_ball_4,
            red5: combo.red_ball_5,
            sum: combo.sum_value,
            span: combo.span_value,
            zone_ratio: combo.zone_ratio || '-',
            odd_even: combo.odd_even_ratio || '-',
            hwc_ratio: combo.hot_warm_cold_ratio || '-',
            ac: combo.ac_value,
            consecutive_groups: combo.consecutive_groups !== undefined ? combo.consecutive_groups : '-',
            max_consecutive_length: formatConsecutive(combo),
            exclude_reason: detailedReason  // ⭐ 使用详细原因
        });

        // 斑马纹
        if (rowIndex % 2 === 0) {
            dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }
        rowIndex++;
    }
}
```

---

## 四、Sheet 2 最终效果示例

```
=== Step 7: 连号组数排除 (排除 150 个组合) ===
01  05  12  23  35  75  27  2:1:2  3:2   4:1:0  6   0   无连号        连号组数=0（无连号）
02  08  15  20  34  80  26  2:2:1  2:3   3:2:0  7   2   2连号         连号组数=2

=== Step 8: 最长连号长度排除 (排除 80 个组合) ===
01  02  03  04  05  15  4   1:0:4  2:3   4:1:0  0   1   5连号全连     最长5连号(01-02-03-04-05)
03  04  05  18  29  59  26  2:1:2  3:2   3:2:0  5   1   3连号         最长3连号(03-04-05)

=== Step 9: 相克对排除 (排除 60 个组合) ===
02  13  27  31  35  108 33  2:2:1  3:2   2:3:0  8   0   无连号        包含相克对: 02-27
01  15  19  22  33  90  32  2:1:2  2:3   3:1:1  7   0   无连号        包含相克对: 15-33, 19-22
05  07  12  28  35  87  30  2:1:2  3:2   2:2:1  8   0   无连号        包含相克对: 07-35

=== Step 10: 同现比排除 (排除 30 个组合) ===
03  07  12  19  28  69  25  2:2:1  3:2   4:1:0  8   0   无连号        包含3个高频号: 03, 07, 12
01  05  11  15  23  55  22  1:2:2  3:2   3:2:0  9   0   无连号        包含4个高频号: 01, 05, 11, 15
```

---

## 五、实施时间调整

| 阶段 | 原时间 | 新时间 | 调整原因 |
|------|--------|--------|---------|
| Schema扩展 | - | +15分钟 | 新增exclusion_details_map字段 |
| 连号组数排除 | 15分钟 | 30分钟 | 增加详细原因记录 |
| 最长连号排除 | 15分钟 | 30分钟 | 增加详细原因记录 |
| 相克对排除 | 1小时 | 1.5小时 | 增加详细原因记录 |
| 同现比排除 | 1小时 | 1.5小时 | 增加详细原因记录 |
| Sheet 2导出 | 1小时 | 1小时 | 读取详细原因（无额外时间）|
| 测试验证 | 30分钟 | 30分钟 | - |

**总计**：约 **5.5小时**（从4小时增加到5.5小时）

---

## 六、数据库影响

### Schema变更
需要在 `dltExclusionDetailsSchema` 中添加一个字段：
```javascript
exclusion_details_map: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
}
```

### 数据量估算
每个被排除的组合增加约50-100字节的详细信息：
- 连号组数：`{ consecutive_groups: 0, description: "无连号" }` ≈ 40字节
- 相克对：`{ conflict_pairs: ["02-27"], description: "包含相克对: 02-27" }` ≈ 80字节
- 同现比：`{ hot_numbers: [3,7,12], description: "包含3个高频号: 03, 07, 12" }` ≈ 100字节

**总增量**：约500个组合 × 70字节 = 35KB（可忽略）

---

## 七、确认点清单（更新）

| 确认项 | 设计决策 | 是否同意 |
|--------|---------|---------|
| 1 | 扩展DLTExclusionDetails Schema，增加exclusion_details_map字段 | ⬜ |
| 2 | 连号组数：显示"连号组数=0（无连号）" | ⬜ |
| 3 | 最长连号：显示"最长5连号(01-02-03-04-05)" | ⬜ |
| 4 | 相克对：显示"包含相克对: 02-27, 15-33" | ⬜ |
| 5 | 同现比：显示"包含3个高频号: 03, 07, 12" | ⬜ |
| 6 | 实施时间从4小时增加到5.5小时 | ⬜ |

---

**准备状态**：✅ 详细方案完整，等待确认！

如果您同意此方案，我将立即开始实施！🚀
