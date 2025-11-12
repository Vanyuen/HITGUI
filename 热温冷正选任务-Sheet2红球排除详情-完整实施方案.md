# 热温冷正选任务 - Sheet 2 红球排除详情表 完整实施方案

## 一、功能定位明确

### 1.1 Sheet 2 的定位
**名称**：红球排除详情表
**数据来源**：**排除条件阶段**（Step 7-10）被排除的红球组合
**数据起点**：正选6步后的3,200个组合
**数据终点**：最终保留的2,800个组合

### 1.2 不包含的内容
❌ **正选条件**（Step 1-6）：热温冷比、区间比、和值、跨度、**奇偶比**、**AC值**
- 理由：这些是**正选过程**，从324,632个筛选到3,200个，数据量太大
- 正选阶段的排除详情已保存在 `DLTExclusionDetails`（step 2-6），但不在Sheet 2展示

### 1.3 包含的内容
✅ **排除条件**（Step 7-10）：在3,200个正选结果基础上的排除

| Step | 排除条件 | 当前状态 | 需要的工作 |
|------|---------|---------|-----------|
| 7 | 连号组数排除 | ✅ 逻辑已实现，❌ 未记录详情 | 补充记录被排除的组合ID |
| 8 | 最长连号长度排除 | ✅ 逻辑已实现，❌ 未记录详情 | 补充记录被排除的组合ID |
| 9 | 相克对排除 | ❌ 未实现 | 实现排除逻辑 + 记录详情 |
| 10 | 同现比排除 | ❌ 未实现 | 实现排除逻辑 + 记录详情 |

**数据量估算**：
- 输入：3,200个组合（正选后）
- Step 7排除：约100-200个（连号组数）
- Step 8排除：约50-150个（最长连号）
- Step 9排除：约50-100个（相克对）
- Step 10排除：约20-50个（同现比）
- **总计**：约220-500个被排除的组合 ✅ 数据量完全可控

---

## 二、Sheet 2 表结构设计

### 2.1 列定义

| 列序号 | 列名 | Key | 宽度 | 说明 |
|--------|------|-----|------|------|
| 1 | 红球1 | red1 | 8 | |
| 2 | 红球2 | red2 | 8 | |
| 3 | 红球3 | red3 | 8 | |
| 4 | 红球4 | red4 | 8 | |
| 5 | 红球5 | red5 | 8 | |
| 6 | 和值 | sum | 8 | |
| 7 | 跨度 | span | 8 | |
| 8 | 区间比 | zone_ratio | 10 | |
| 9 | 奇偶比 | odd_even | 10 | |
| 10 | 热温冷比 | hwc_ratio | 10 | |
| 11 | AC值 | ac | 8 | |
| 12 | 连号组数 | consecutive_groups | 10 | |
| 13 | 最长连号 | max_consecutive_length | 10 | |
| 14 | 排除原因 | exclude_reason | 30 | 中文描述 |

### 2.2 呈现方式：按排除条件分组

```
=== Step 7: 连号组数排除 (排除 150 个组合) ===
[数据行 1-150]

=== Step 8: 最长连号长度排除 (排除 80 个组合) ===
[数据行 151-230]

=== Step 9: 相克对排除 (排除 60 个组合) ===
[数据行 231-290]

=== Step 10: 同现比排除 (排除 30 个组合) ===
[数据行 291-320]
```

**分组标题行样式**：
- 字体：加粗，11号
- 背景色：浅蓝色 `#E3F2FD`
- 对齐：左对齐
- 合并：第1-3列合并显示完整标题

**数据行样式**：
- 偶数行：浅灰背景 `#F5F5F5`（斑马纹）
- 奇数行：白色背景

---

## 三、技术实施方案

### 3.1 阶段1：补充连号条件的排除详情记录（30分钟）

#### 修改文件：`src/server/server.js`

#### 修改位置1：连号组数排除（20952-20986行）

**当前代码**：
```javascript
// ⭐ 5.1 连号组数排除
if (exclusion_conditions?.consecutiveGroups?.enabled) {
    const { groups } = exclusion_conditions.consecutiveGroups;

    if (groups && groups.length > 0) {
        log(`  🔢 应用连号组数排除: 排除 ${groups.join(', ')} 组`);

        const beforeCount = combinations.length;

        // 过滤: 排除指定连号组数的组合
        combinations = combinations.filter(combo => {
            // ... 过滤逻辑 ...
            return !groups.includes(consecutiveGroups);
        });

        const excludedCount = beforeCount - combinations.length;
        log(`  🔢 连号组数排除后: ${combinations.length} 个组合 (排除${excludedCount}个)`);
    }
}
```

**修改为**：
```javascript
// ⭐ 5.1 连号组数排除
if (exclusion_conditions?.consecutiveGroups?.enabled) {
    const { groups } = exclusion_conditions.consecutiveGroups;

    if (groups && groups.length > 0) {
        log(`  🔢 应用连号组数排除: 排除 ${groups.join(', ')} 组`);

        const beforeIds = combinations.map(c => c.combination_id);  // ⭐ 新增
        const beforeCount = combinations.length;

        // 过滤: 排除指定连号组数的组合
        combinations = combinations.filter(combo => {
            let consecutiveGroups;
            if (combo.consecutive_groups !== undefined && combo.consecutive_groups !== null) {
                consecutiveGroups = combo.consecutive_groups;
            } else {
                const redBalls = [
                    combo.red_ball_1,
                    combo.red_ball_2,
                    combo.red_ball_3,
                    combo.red_ball_4,
                    combo.red_ball_5
                ];
                const analysis = analyzeConsecutive(redBalls);
                consecutiveGroups = analysis.consecutiveGroups;
            }

            // 保留: 连号组数不在排除列表中
            return !groups.includes(consecutiveGroups);
        });

        const afterIds = combinations.map(c => c.combination_id);   // ⭐ 新增
        const excludedCount = beforeCount - combinations.length;

        // ⭐ 计算并保存排除的ID
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 7,
                condition: 'exclusion_consecutive_groups',
                excludedIds: excludedIds
            });
        }

        log(`  🔢 连号组数排除后: ${combinations.length} 个组合 (排除${excludedCount}个)`);
    }
}
```

#### 修改位置2：最长连号长度排除（20988-21022行）

**修改为**（类似上面）：
```javascript
// ⭐ 5.2 最长连号长度排除
if (exclusion_conditions?.maxConsecutiveLength?.enabled) {
    const { lengths } = exclusion_conditions.maxConsecutiveLength;

    if (lengths && lengths.length > 0) {
        log(`  📏 应用最长连号长度排除: 排除 ${lengths.join(', ')}`);

        const beforeIds = combinations.map(c => c.combination_id);  // ⭐ 新增
        const beforeCount = combinations.length;

        // 过滤: 排除指定最长连号长度的组合
        combinations = combinations.filter(combo => {
            let maxConsecutiveLength;
            if (combo.max_consecutive_length !== undefined && combo.max_consecutive_length !== null) {
                maxConsecutiveLength = combo.max_consecutive_length;
            } else {
                const redBalls = [
                    combo.red_ball_1,
                    combo.red_ball_2,
                    combo.red_ball_3,
                    combo.red_ball_4,
                    combo.red_ball_5
                ];
                const analysis = analyzeConsecutive(redBalls);
                maxConsecutiveLength = analysis.maxConsecutiveLength;
            }

            // 保留: 最长连号长度不在排除列表中
            return !lengths.includes(maxConsecutiveLength);
        });

        const afterIds = combinations.map(c => c.combination_id);   // ⭐ 新增
        const excludedCount = beforeCount - combinations.length;

        // ⭐ 计算并保存排除的ID
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 8,
                condition: 'exclusion_max_consecutive_length',
                excludedIds: excludedIds
            });
        }

        log(`  📏 最长连号长度排除后: ${combinations.length} 个组合 (排除${excludedCount}个)`);
    }
}
```

---

### 3.2 阶段2：实现相克对排除（1小时）

#### 添加位置：20988-21022行之后

```javascript
// ⭐ 5.3 相克对排除
if (exclusion_conditions?.conflictPairs?.enabled) {
    log(`  ⚔️ 应用相克对排除...`);

    const beforeIds = combinations.map(c => c.combination_id);
    const beforeCount = combinations.length;

    // 构建相克对Set（从历史数据分析）
    const conflictPairsSet = new Set();

    // 简化实现：分析最近50期，找出从未同时出现的号码对
    const recentIssues = await DLT.find({})
        .sort({ Issue: -1 })
        .limit(50)
        .lean();

    // 统计所有号码对的同现次数
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

    // 找出相克对（同现次数 <= 阈值，例如 <= 2 次）
    const threshold = 2;
    for (const [pair, count] of pairCounts) {
        if (count <= threshold) {
            conflictPairsSet.add(pair);
        }
    }

    log(`  ⚔️ 识别到 ${conflictPairsSet.size} 对相克号码`);

    // 过滤：排除包含相克对的组合
    combinations = combinations.filter(combo => {
        const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

        // 检查组合中是否包含相克对
        for (let i = 0; i < balls.length - 1; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const key = balls[i] < balls[j] ? `${balls[i]}-${balls[j]}` : `${balls[j]}-${balls[i]}`;
                if (conflictPairsSet.has(key)) {
                    return false; // 包含相克对，排除
                }
            }
        }
        return true; // 不包含相克对，保留
    });

    const afterIds = combinations.map(c => c.combination_id);
    const excludedCount = beforeCount - combinations.length;

    // ⭐ 保存排除的ID
    const afterIdSet = new Set(afterIds);
    const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

    if (excludedIds.length > 0) {
        exclusionsToSave.push({
            step: 9,
            condition: 'exclusion_conflict_pairs',
            excludedIds: excludedIds
        });
    }

    log(`  ⚔️ 相克对排除后: ${combinations.length} 个组合 (排除${excludedCount}个)`);
}
```

---

### 3.3 阶段3：实现同现比排除（1小时）

#### 添加位置：相克对排除之后

```javascript
// ⭐ 5.4 同现比排除
if (exclusion_conditions?.coOccurrence?.enabled) {
    log(`  🔗 应用同现比排除...`);

    const beforeIds = combinations.map(c => c.combination_id);
    const beforeCount = combinations.length;

    // 获取前一期的遗漏值数据
    const previousIssue = parseInt(targetIssue) - 1;
    const missingRecord = await mongoose.connection.db
        .collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({ Issue: previousIssue.toString() });

    if (missingRecord) {
        // 找出遗漏值 <= 5 的号码（高频号）
        const hotNumbers = [];
        for (let i = 1; i <= 35; i++) {
            const missing = missingRecord[`RedBall_${String(i).padStart(2, '0')}`];
            if (missing !== undefined && missing <= 5) {
                hotNumbers.push(i);
            }
        }

        log(`  🔗 识别到 ${hotNumbers.length} 个高频号: ${hotNumbers.join(', ')}`);

        // 过滤：排除包含 >= 3 个高频号的组合
        combinations = combinations.filter(combo => {
            const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

            let hotCount = 0;
            for (const ball of balls) {
                if (hotNumbers.includes(ball)) {
                    hotCount++;
                }
            }

            // 保留：高频号不超过2个
            return hotCount <= 2;
        });

        const afterIds = combinations.map(c => c.combination_id);
        const excludedCount = beforeCount - combinations.length;

        // ⭐ 保存排除的ID
        const afterIdSet = new Set(afterIds);
        const excludedIds = beforeIds.filter(id => !afterIdSet.has(id));

        if (excludedIds.length > 0) {
            exclusionsToSave.push({
                step: 10,
                condition: 'exclusion_co_occurrence',
                excludedIds: excludedIds
            });
        }

        log(`  🔗 同现比排除后: ${combinations.length} 个组合 (排除${excludedCount}个)`);
    } else {
        log(`  ⚠️ 未找到前一期 ${previousIssue} 的遗漏值数据，跳过同现比排除`);
    }
}
```

---

### 3.4 阶段4：实现Sheet 2导出逻辑（1小时）

#### 修改文件：`src/server/server.js`
#### 修改位置：导出API（20001-20422行）中的 Sheet 2 部分（20274-20319行）

**当前代码**：
```javascript
// ===== Sheet 2: 红球排除详情表 =====
// TODO: 需要实现排除逻辑重算，获取被排除的组合
const sheet2 = workbook.addWorksheet('红球排除详情');
// ... 仅有占位符 ...
```

**替换为完整实现**：
```javascript
// ===== Sheet 2: 红球排除详情表（排除条件阶段）=====
log(`  📋 生成 Sheet 2: 红球排除详情表...`);
const sheet2 = workbook.addWorksheet('红球排除详情');

sheet2.columns = [
    { header: '红球1', key: 'red1', width: 8 },
    { header: '红球2', key: 'red2', width: 8 },
    { header: '红球3', key: 'red3', width: 8 },
    { header: '红球4', key: 'red4', width: 8 },
    { header: '红球5', key: 'red5', width: 8 },
    { header: '和值', key: 'sum', width: 8 },
    { header: '跨度', key: 'span', width: 8 },
    { header: '区间比', key: 'zone_ratio', width: 10 },
    { header: '奇偶比', key: 'odd_even', width: 10 },
    { header: '热温冷比', key: 'hwc_ratio', width: 10 },
    { header: 'AC值', key: 'ac', width: 8 },
    { header: '连号组数', key: 'consecutive_groups', width: 10 },
    { header: '最长连号', key: 'max_consecutive_length', width: 10 },
    { header: '排除原因', key: 'exclude_reason', width: 30 }
];

// 表头样式
sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
sheet2.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF9800' }
};

// 1. 查询所有排除详情（仅Step 7-10：排除条件阶段）
const exclusionRecords = await DLTExclusionDetails.find({
    task_id,
    period: period.toString(),
    step: { $in: [7, 8, 9, 10] }  // ⭐ 仅查询排除条件阶段
}).sort({ step: 1, chunk_index: 1 }).lean();

log(`  📊 查询到 ${exclusionRecords.length} 条排除详情记录（Step 7-10）`);

// 2. 按步骤分组并合并分片
const excludedByStep = {};
for (const record of exclusionRecords) {
    if (!excludedByStep[record.step]) {
        excludedByStep[record.step] = {
            condition: record.condition,
            ids: []
        };
    }
    excludedByStep[record.step].ids.push(...record.excluded_combination_ids);
}

// 3. 查询所有被排除的组合详情（去重）
const allExcludedIds = [...new Set(
    Object.values(excludedByStep).flatMap(s => s.ids)
)];

log(`  📊 共 ${allExcludedIds.length} 个被排除的组合（去重后）`);

if (allExcludedIds.length === 0) {
    // 无排除数据，添加提示行
    sheet2.addRow({
        red1: '-',
        red2: '-',
        red3: '-',
        red4: '-',
        red5: '-',
        exclude_reason: '当前任务未启用排除条件，无被排除的组合'
    });
} else {
    // 批量查询组合详情
    const excludedCombos = await DLTRedCombinations.find({
        combination_id: { $in: allExcludedIds }
    }).lean();

    // 构建ID到组合的映射
    const comboMap = new Map(excludedCombos.map(c => [c.combination_id, c]));

    log(`  📊 查询到 ${excludedCombos.length} 个组合的详细信息`);

    // 排除原因映射
    const conditionLabels = {
        'exclusion_consecutive_groups': '连号组数不符合要求',
        'exclusion_max_consecutive_length': '最长连号长度不符合要求',
        'exclusion_conflict_pairs': '包含相克号码对',
        'exclusion_co_occurrence': '高频号过多（同现比超标）'
    };

    // 步骤名称映射
    const stepNames = {
        7: '连号组数排除',
        8: '最长连号长度排除',
        9: '相克对排除',
        10: '同现比排除'
    };

    // 4. 按步骤生成Excel行
    let totalRowsAdded = 0;
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

        // 标题行样式
        titleRow.font = { bold: true, size: 11 };
        titleRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };
        titleRow.alignment = { horizontal: 'left' };

        // 添加数据行
        let rowIndex = 0;
        for (const id of stepData.ids) {
            const combo = comboMap.get(id);
            if (!combo) continue;

            // 格式化连号情况
            let consecutiveDisplay = '-';
            if (combo.max_consecutive_length > 0) {
                consecutiveDisplay = combo.max_consecutive_length === 2 ? '2连号' :
                                   combo.max_consecutive_length === 3 ? '3连号' :
                                   combo.max_consecutive_length >= 4 ? `${combo.max_consecutive_length}连号` : '-';
            } else {
                consecutiveDisplay = '无连号';
            }

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
                max_consecutive_length: consecutiveDisplay,
                exclude_reason: conditionLabels[stepData.condition] || stepData.condition
            });

            // 斑马纹：偶数行灰色背景
            if (rowIndex % 2 === 0) {
                dataRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }

            rowIndex++;
            totalRowsAdded++;
        }
    }

    log(`  ✅ Sheet 2 完成: 共添加 ${totalRowsAdded} 行排除数据`);
}
```

---

## 四、实施计划与时间估算

### 阶段划分

| 阶段 | 任务 | 预计时间 | 文件修改 |
|------|------|---------|---------|
| **阶段1** | 补充连号组数排除记录 | 15分钟 | `server.js` (20952-20986行) |
| **阶段1** | 补充最长连号排除记录 | 15分钟 | `server.js` (20988-21022行) |
| **阶段2** | 实现相克对排除逻辑 | 1小时 | `server.js` (新增，21022行后) |
| **阶段3** | 实现同现比排除逻辑 | 1小时 | `server.js` (新增，相克对后) |
| **阶段4** | 实现Sheet 2导出逻辑 | 1小时 | `server.js` (20274-20319行) |
| **测试** | 创建测试任务并验证 | 30分钟 | - |

**总计**：约 4 小时

---

## 五、验证测试方案

### 5.1 测试步骤

1. **创建测试任务**（包含全部排除条件）
```javascript
// 热温冷正选 + 全部排除条件
{
    task_name: "Sheet2测试任务",
    period_range: { type: "recent", total: 5 },
    positive_selection: {
        hwc_ratios: ["4:1:0", "3:2:0"],
        zone_ratios: ["2:1:2", "2:2:1"],
        sum_ranges: [{ min: 65, max: 95 }],
        span_ranges: [{ min: 15, max: 30 }],
        odd_even_ratios: ["3:2", "2:3"],
        ac_values: [5, 6, 7, 8]
    },
    exclusion_conditions: {
        consecutiveGroups: {
            enabled: true,
            groups: [0, 4]  // 排除无连号和4连号
        },
        maxConsecutiveLength: {
            enabled: true,
            lengths: [5]  // 排除5连号
        },
        conflictPairs: {
            enabled: true
        },
        coOccurrence: {
            enabled: true
        }
    }
}
```

2. **等待任务完成**

3. **导出Excel验证**
   - Sheet 1：预测组合表（最终保留的组合）
   - **Sheet 2：红球排除详情表**（Step 7-10排除的组合）⭐
   - Sheet 3：排除统计表（汇总）

4. **检查Sheet 2内容**
   - ✅ 是否有4个分组（Step 7-10）
   - ✅ 每个分组的标题行样式正确
   - ✅ 数据行完整（红球、特征值、排除原因）
   - ✅ 斑马纹样式正确

### 5.2 数据库验证

```javascript
// 1. 查询排除条件的排除详情
db.hit_dlt_exclusiondetails.find({
    task_id: "hwc-pos-20250111-001",
    period: "25121",
    step: { $in: [7, 8, 9, 10] }  // 仅排除条件阶段
}).pretty();

// 2. 统计每步排除数量
db.hit_dlt_exclusiondetails.aggregate([
    {
        $match: {
            task_id: "hwc-pos-20250111-001",
            period: "25121"
        }
    },
    {
        $group: {
            _id: "$step",
            count: { $sum: "$excluded_count" },
            condition: { $first: "$condition" }
        }
    },
    { $sort: { _id: 1 } }
]);
```

---

## 六、注意事项与风险

### 6.1 性能考虑

| 场景 | 风险 | 对策 |
|------|------|------|
| 相克对计算耗时 | 分析50期×C(35,2)对 | 使用Map缓存，复杂度O(n) |
| 同现比查询慢 | 查询遗漏值历史表 | 添加索引，限制查询期数 |
| 组合详情查询慢 | 一次查询500个ID | 批量查询，使用$in优化 |

### 6.2 数据一致性

- ✅ 所有排除详情保存到同一个事务（异步Promise.all）
- ✅ 分片支持：单个条件排除超过5万个时自动分片
- ✅ 去重处理：allExcludedIds使用Set去重

### 6.3 向后兼容

- ✅ 旧任务无排除详情时，Sheet 2显示友好提示
- ✅ 未启用排除条件时，Sheet 2显示"无被排除的组合"

---

## 七、交付物

### 7.1 代码修改
- ✅ `src/server/server.js`：4处修改
  - 行20952-20986：补充连号组数记录
  - 行20988-21022：补充最长连号记录
  - 行21022后：新增相克对排除
  - 行相克对后：新增同现比排除
  - 行20274-20319：实现Sheet 2导出

### 7.2 文档
- ✅ 本方案文档（`热温冷正选任务-Sheet2红球排除详情-完整实施方案.md`）
- ✅ 流程详解文档（已生成）

### 7.3 测试脚本
- ✅ MongoDB验证查询（见5.2节）

---

## 八、预期效果

**导出的Excel包含**：

### Sheet 1：预测组合表
- 内容：最终保留的2,800个组合（5红+2蓝）
- 列：红球、蓝球、特征值、命中分析、中奖情况

### Sheet 2：红球排除详情表 ⭐ **本次新增**
- 内容：**仅排除条件阶段**（Step 7-10）被排除的约220-500个红球组合
- 分组：
  - Step 7: 连号组数排除（如无连号、4连号）
  - Step 8: 最长连号长度排除（如5连号）
  - Step 9: 相克对排除（包含相克号码对）
  - Step 10: 同现比排除（高频号过多）
- 列：红球1-5、和值、跨度、区间比、奇偶比、热温冷比、AC值、连号组数、最长连号、排除原因

### Sheet 3：排除统计表
- 内容：各类排除条件的统计汇总

---

## 九、确认点清单

请您确认以下设计决策：

| 确认项 | 设计决策 | 是否同意 |
|--------|---------|---------|
| 1 | Sheet 2仅包含**排除条件阶段**（Step 7-10），不包含正选条件（Step 1-6） | ⬜ |
| 2 | 需要实现全部4个排除条件（连号×2 + 相克对 + 同现比） | ⬜ |
| 3 | 相克对排除逻辑：简化版，分析最近50期，同现≤2次视为相克 | ⬜ |
| 4 | 同现比排除逻辑：简化版，高频号（遗漏≤5）超过2个即排除 | ⬜ |
| 5 | 分组方式：按Step 7-10分组，每组添加标题行 | ⬜ |
| 6 | 样式：标题行浅蓝色，数据行斑马纹 | ⬜ |
| 7 | 预计实施时间：4小时（含测试） | ⬜ |

---

**生成时间**：2025-01-11
**准备状态**：✅ 方案完整，等待确认后立即实施

---

请您确认以上方案，我将立即开始实施！🚀
