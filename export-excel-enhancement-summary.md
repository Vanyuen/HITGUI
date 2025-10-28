# 导出排除详情Excel功能增强总结

## 修改内容

在导出排除详情Excel的"保留的组合"工作表中，添加了两个新列：
- **红球命中** - 显示该组合命中的红球数量（0-5）
- **蓝球命中** - 显示该组合命中的蓝球数量（0-2）

这两列位于"中奖情况"列之前，方便用户直观了解中奖原因。

## 修改前后对比

### 修改前的列结构
| 序号 | 组合ID | 红球1-5 | 蓝球1-2 | 配对索引 | 配对模式 | 和值 | 跨度 | 区间比 | 奇偶比 | 热温冷比 | 连号组数 | 最长连号 | 中奖情况 | 奖金(元) |
|------|--------|---------|---------|---------|---------|------|------|--------|--------|---------|---------|---------|---------|---------|

### 修改后的列结构
| 序号 | 组合ID | 红球1-5 | 蓝球1-2 | 配对索引 | 配对模式 | 和值 | 跨度 | 区间比 | 奇偶比 | 热温冷比 | 连号组数 | 最长连号 | **红球命中** | **蓝球命中** | 中奖情况 | 奖金(元) |
|------|--------|---------|---------|---------|---------|------|------|--------|--------|---------|---------|---------|------------|------------|---------|---------|

## 示例数据

假设实际开奖号码为：红球 `05, 12, 18, 25, 33`，蓝球 `02, 11`

| 红球1 | 红球2 | 红球3 | 红球4 | 红球5 | 蓝球1 | 蓝球2 | 红球命中 | 蓝球命中 | 中奖情况 | 奖金(元) |
|-------|-------|-------|-------|-------|-------|-------|---------|---------|---------|---------|
| 03 | 07 | 15 | 22 | 31 | 05 | 09 | 0 | 0 | 未中奖 | 0 |
| 05 | 12 | 18 | 25 | 30 | 02 | 11 | 4 | 2 | 四等奖 | 3000 |
| 05 | 12 | 18 | 25 | 33 | 02 | 08 | 5 | 1 | 二等奖 | 100000 |
| 05 | 12 | 18 | 23 | 28 | 02 | 11 | 3 | 2 | 六等奖 | 200 |
| 12 | 18 | 25 | 28 | 30 | 02 | 11 | 3 | 2 | 六等奖 | 200 |
| 05 | 12 | 18 | 25 | 33 | 02 | 11 | 5 | 2 | 一等奖 | 10000000 |

## 用户价值

添加这两列后，用户可以：

1. **直观理解中奖原因**
   - 一眼看出为什么某个组合中了某个奖项
   - 例如：看到"3红+1蓝"，立即明白是八等奖

2. **便于数据筛选**
   - 可以筛选出所有4红命中的组合
   - 可以筛选出所有2蓝命中的组合
   - 方便进行统计分析

3. **验证中奖判断**
   - 可以快速验证系统的中奖判断是否正确
   - 对照大乐透中奖规则表进行核对

4. **数据分析**
   - 分析不同命中组合的分布情况
   - 统计各个命中级别的数量

## 技术实现

### 修改位置
文件：`src/server/server.js`
接口：`GET /api/dlt/export-exclusion-details/:taskId/:period`

### 修改1：列定义（行 13871-13895）

```javascript
const retainedColumns = [
    { header: '序号', key: 'index', width: 8 },
    { header: '组合ID', key: 'combination_id', width: 12 },
    { header: '红球1', key: 'red1', width: 8 },
    { header: '红球2', key: 'red2', width: 8 },
    { header: '红球3', key: 'red3', width: 8 },
    { header: '红球4', key: 'red4', width: 8 },
    { header: '红球5', key: 'red5', width: 8 },
    { header: '蓝球1', key: 'blue1', width: 8 },
    { header: '蓝球2', key: 'blue2', width: 8 },
    { header: '配对索引', key: 'pairing_index', width: 12 },
    { header: '配对模式', key: 'pairing_mode', width: 12 },
    { header: '和值', key: 'sum', width: 8 },
    { header: '跨度', key: 'span', width: 8 },
    { header: '区间比', key: 'zone_ratio', width: 12 },
    { header: '奇偶比', key: 'odd_even_ratio', width: 12 },
    { header: '热温冷比', key: 'hwc_ratio', width: 12 },
    { header: '连号组数', key: 'consecutive_groups', width: 12 },
    { header: '最长连号', key: 'max_consecutive_length', width: 12 },
    { header: '红球命中', key: 'red_hit', width: 10 },      // ✅ 新增
    { header: '蓝球命中', key: 'blue_hit', width: 10 },     // ✅ 新增
    { header: '中奖情况', key: 'prize', width: 15 },
    { header: '奖金(元)', key: 'prize_amount', width: 12 }
];
```

### 修改2：数据生成（行 13978-14001）

```javascript
retainedRows.push({
    index: i + 1,
    combination_id: combo.combination_id,
    red1: combo.red_ball_1,
    red2: combo.red_ball_2,
    red3: combo.red_ball_3,
    red4: combo.red_ball_4,
    red5: combo.red_ball_5,
    blue1: blueCombo ? blueCombo.blue_ball_1 : '-',
    blue2: blueCombo ? blueCombo.blue_ball_2 : '-',
    pairing_index: pairingIndex !== null ? pairingIndex : '-',
    pairing_mode: displayPairingMode,
    sum: combo.sum_value,
    span: combo.span_value,
    zone_ratio: combo.zone_ratio,
    odd_even_ratio: combo.odd_even_ratio,
    hwc_ratio: hwcRatio,
    consecutive_groups: combo.consecutive_groups,
    max_consecutive_length: combo.max_consecutive_length,
    red_hit: redHit,           // ✅ 新增：红球命中数
    blue_hit: blueHit,         // ✅ 新增：蓝球命中数
    prize: prize,
    prize_amount: prizeAmount
});
```

## 数据来源

- `redHit` - 由 `calculateRedHit(redBalls, actualRed)` 函数计算
- `blueHit` - 由 `calculateBlueHit(blueBalls, actualBlue)` 函数计算

这两个函数已经在代码中存在（行 13660-13670），用于计算命中数并判断中奖情况。

## 兼容性

- ✅ 不影响现有功能
- ✅ 只是在Excel中添加了两列，不改变任何业务逻辑
- ✅ 对其他工作表（排除详情工作表）无影响

## 测试建议

1. 导出一个已有任务的排除详情Excel
2. 检查"保留的组合"工作表中是否有"红球命中"和"蓝球命中"两列
3. 验证列的位置是否在"中奖情况"之前
4. 检查命中数是否正确（与实际开奖号码对比）
5. 验证命中数与中奖情况是否匹配

## 修改时间

2025-10-25

---

**总结**：此次增强使得导出的Excel文件更加直观易懂，用户可以更方便地理解和分析中奖数据。
