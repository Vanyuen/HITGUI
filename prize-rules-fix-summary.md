# 大乐透中奖规则判断BUG修复总结

## 问题描述

在任务卡详情的"导出排除详情"功能中，中奖判断规则存在严重错误，导致：
1. 多个奖项判断错误
2. 奖金金额计算错误
3. 用户对中奖情况产生误判

## 受影响的功能

1. **导出排除详情功能** (`/api/dlt/export-exclusion-details/:taskId/:period`)
   - 使用的函数：`judgePrize(redHit, blueHit)` (src/server/server.js:13572-13616)

2. **命中统计功能** (`calculatePrizeStats` 方法)
   - 位置：src/server/server.js:12124-12309
   - 包含两种模式：
     - unlimited模式（固定配对）
     - 笛卡尔积模式（default/truly-unlimited）

## 大乐透官方中奖规则

| 奖项 | 前区命中 | 后区命中 | 中奖条件 | 奖金(元) |
|------|---------|---------|---------|---------|
| 一等奖 | 5 | 2 | `5+2` | 浮动(约1000万) |
| 二等奖 | 5 | 1 | `5+1` | 浮动(约10万) |
| 三等奖 | 5 | 0 | `5+0` | 10000 |
| 四等奖 | 4 | 2 | `4+2` | 3000 |
| 五等奖 | 4 | 1 | `4+1` | 300 |
| 六等奖 | 3 | 2 | `3+2` | 200 |
| 七等奖 | 4 | 0 | `4+0` | 100 |
| 八等奖 | 3 | 1 **或** 2 | 2 | `3+1` 或 `2+2` | 15 |
| 九等奖 | 3 | 0 **或** 1 | 2 **或** 2 | 1 **或** 0 | 2 | `3+0` 或 `1+2` 或 `2+1` 或 `0+2` | 5 |

## 修复前的错误

### judgePrize 函数错误对照表

| 命中情况 | 错误判断 | 正确判断 | 错误影响 |
|---------|---------|---------|---------|
| 3红+2蓝 | 五等奖(300元) | **六等奖(200元)** | 奖金错误 |
| 4红+0蓝 | 六等奖(200元) | **七等奖(100元)** | 奖项和奖金错误 |
| 3红+1蓝 | 六等奖(200元) | **八等奖(15元)** | 奖项和奖金错误 |
| 2红+2蓝 | 六等奖(200元) | **八等奖(15元)** | 奖项和奖金错误 |
| 3红+0蓝 | 七等奖(100元) | **九等奖(5元)** | 奖项和奖金错误 |
| 1红+2蓝 | 七等奖(100元) | **九等奖(5元)** | 奖项和奖金错误 |
| 2红+1蓝 | 八等奖(15元) | **九等奖(5元)** | 奖项和奖金错误 |
| 2红+0蓝 | 九等奖(5元) | **未中奖** | 错误显示中奖 |
| 1红+1蓝 | 九等奖(5元) | **未中奖** | 错误显示中奖 |
| 0红+2蓝 | **缺失** | **九等奖(5元)** | 漏掉中奖情况 |

### calculatePrizeStats 方法错误

unlimited模式和笛卡尔积模式都存在相同的错误逻辑：

```javascript
// ❌ 错误的七等奖判断（应该只有 4+0）
else if ((r === 3 && b === 0) || (r === 2 && b === 1) || (r === 1 && b === 2)) {
    prize_stats.seventh_prize.count++;  // 错误！
}

// ❌ 错误的八等奖判断（应该是 3+1 或 2+2）
else if ((r === 2 && b === 0) || (r === 1 && b === 1) || (r === 0 && b === 2)) {
    prize_stats.eighth_prize.count++;  // 错误！
}

// ❌ 错误的九等奖判断（应该是 3+0 或 1+2 或 2+1 或 0+2）
else if ((r === 1 && b === 0) || (r === 0 && b === 1)) {
    prize_stats.ninth_prize.count++;  // 错误！
}
```

## 修复方案

### 1. 修复 judgePrize 函数

```javascript
function judgePrize(redHit, blueHit) {
    // 一等奖：5+2
    if (redHit === 5 && blueHit === 2) return '一等奖';
    // 二等奖：5+1
    if (redHit === 5 && blueHit === 1) return '二等奖';
    // 三等奖：5+0
    if (redHit === 5 && blueHit === 0) return '三等奖';
    // 四等奖：4+2
    if (redHit === 4 && blueHit === 2) return '四等奖';
    // 五等奖：4+1
    if (redHit === 4 && blueHit === 1) return '五等奖';
    // 六等奖：3+2
    if (redHit === 3 && blueHit === 2) return '六等奖';
    // 七等奖：4+0
    if (redHit === 4 && blueHit === 0) return '七等奖';
    // 八等奖：3+1 或 2+2
    if (redHit === 3 && blueHit === 1) return '八等奖';
    if (redHit === 2 && blueHit === 2) return '八等奖';
    // 九等奖：3+0 或 1+2 或 2+1 或 0+2
    if (redHit === 3 && blueHit === 0) return '九等奖';
    if (redHit === 1 && blueHit === 2) return '九等奖';
    if (redHit === 2 && blueHit === 1) return '九等奖';
    if (redHit === 0 && blueHit === 2) return '九等奖';
    return '未中奖';
}
```

### 2. 修复 calculatePrizeStats 方法

将七、八、九等奖的判断逻辑拆分为明确的条件：

```javascript
// 七等奖：4+0
else if (r === 4 && b === 0) {
    prize_stats.seventh_prize.count++;
    prize_stats.seventh_prize.amount += FIXED_PRIZES.seventh;
}
// 八等奖：3+1 或 2+2
else if (r === 3 && b === 1) {
    prize_stats.eighth_prize.count++;
    prize_stats.eighth_prize.amount += FIXED_PRIZES.eighth;
}
else if (r === 2 && b === 2) {
    prize_stats.eighth_prize.count++;
    prize_stats.eighth_prize.amount += FIXED_PRIZES.eighth;
}
// 九等奖：3+0 或 1+2 或 2+1 或 0+2
else if (r === 3 && b === 0) {
    prize_stats.ninth_prize.count++;
    prize_stats.ninth_prize.amount += FIXED_PRIZES.ninth;
}
else if (r === 1 && b === 2) {
    prize_stats.ninth_prize.count++;
    prize_stats.ninth_prize.amount += FIXED_PRIZES.ninth;
}
else if (r === 2 && b === 1) {
    prize_stats.ninth_prize.count++;
    prize_stats.ninth_prize.amount += FIXED_PRIZES.ninth;
}
else if (r === 0 && b === 2) {
    prize_stats.ninth_prize.count++;
    prize_stats.ninth_prize.amount += FIXED_PRIZES.ninth;
}
```

## 验证结果

运行验证脚本 `verify-prize-rules.js`，测试18种情况：

```
✅ 所有测试通过！中奖规则判断正确。
测试结果: 18 通过, 0 失败
```

测试覆盖：
- 9种奖项（一等奖到九等奖）的所有中奖组合
- 不中奖的5种情况

## 修复文件清单

1. **src/server/server.js**
   - 修复 `judgePrize` 函数 (行 13572-13616)
   - 修复 `calculatePrizeStats` 方法的unlimited模式部分 (行 12170-12231)
   - 修复 `calculatePrizeStats` 方法的笛卡尔积模式部分 (行 12237-12303)

2. **新增验证脚本**
   - `verify-prize-rules.js` - 用于验证中奖规则的正确性

## 影响范围

修复后，以下功能的中奖判断将正确：

1. ✅ 导出排除详情Excel的"中奖情况"和"奖金"列
2. ✅ 任务详情页面的命中统计数据
3. ✅ 所有涉及中奖判断的API接口

## 测试建议

1. 重新导出已有任务的排除详情Excel，验证中奖情况和奖金是否正确
2. 对比修复前后的命中统计数据，确认奖项统计无误
3. 使用实际开奖数据进行端到端测试

## 修复时间

2025-10-25

---

**注意**：此次修复涉及核心中奖判断逻辑，建议全面测试后再部署到生产环境。
