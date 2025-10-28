# 🐛 BUG修复：unlimited模式保存为truly-unlimited

## 问题描述

用户选择"普通无限制"模式时：
- **期望**：导出 13,056 个组合（1:1配对）
- **实际**：导出 861,696 个组合（13,056 × 66 笛卡尔积）

## 根本原因

在 `server.js` 中，任务执行时创建的 `config` 对象结构不正确：

```javascript
// ❌ 错误的配置结构（两处）
const config = {
    targetIssues: targetIssues,
    filters: {
        combinationMode: combinationMode  // ⚠️ 只在filters里有
    },
    maxRedCombinations: maxRedCombinations,
    maxBlueCombinations: maxBlueCombinations,
    enableValidation: true
    // ❌ 缺少顶层的 combination_mode 参数
};
```

但 `streamPredict()` 方法期望的参数结构是：

```javascript
async streamPredict(config, progressCallback) {
    const { targetIssues, filters, exclude_conditions,
            maxRedCombinations, maxBlueCombinations,
            enableValidation, combination_mode } = config;  // ⚠️ 从顶层解构
}
```

由于 `combination_mode` 在顶层不存在，解构后值为 `undefined`。

传递链：
1. `combination_mode = undefined` 传给 `streamPredict()` (line 10732)
2. `combination_mode = undefined` 传给 `processBatch()` (line 10769)
3. `combinationMode = undefined` 传给 `processSingleIssue()` (line 10989)
4. `processSingleIssue()` 中的条件 `if (combinationMode === 'unlimited')` 不满足 (line 11027)
5. `pairingMode` 和 `bluePairingIndices` 都不生成
6. 保存结果时使用默认值 `pairing_mode: periodResult.pairing_mode || 'truly-unlimited'` (line 15124)

## 修复内容

### 修复位置1：任务执行API（line 15006）

```javascript
// ✅ 修复后
const config = {
    targetIssues: targetIssues,
    filters: {
        maxRedCombinations: maxRedCombinations,
        maxBlueCombinations: maxBlueCombinations,
        combinationMode: combinationMode
    },
    exclude_conditions: task.exclude_conditions || {},
    maxRedCombinations: maxRedCombinations,
    maxBlueCombinations: maxBlueCombinations,
    enableValidation: true,
    combination_mode: combinationMode  // ⭐ 添加顶层参数
};
```

### 修复位置2：批量预测API（line 12523）

```javascript
// ✅ 修复后
const config = {
    targetIssues,
    filters: {
        ...filters,
        maxRedCombinations: actualMaxRed,
        maxBlueCombinations: actualMaxBlue,
        trulyUnlimited: trulyUnlimited,
        combinationMode: combinationMode
    },
    exclude_conditions: exclude_conditions || {},
    maxRedCombinations: actualMaxRed,
    maxBlueCombinations: actualMaxBlue,
    enableValidation,
    combination_mode: combinationMode  // ⭐ 添加顶层参数
};
```

## 修复效果

修复后，当用户选择"普通无限制"模式时：

1. ✅ `combination_mode = 'unlimited'` 正确传递
2. ✅ `processSingleIssue()` 生成 `pairingMode = 'unlimited'`
3. ✅ `processSingleIssue()` 生成 `bluePairingIndices` 数组
4. ✅ 数据库保存 `pairing_mode = 'unlimited'`
5. ✅ 数据库保存 `blue_pairing_indices = [0,1,2,...,65,0,1,...]`
6. ✅ 导出时使用1:1配对，生成正确的组合数

## 验证步骤

1. 重启应用
2. 创建新的"普通无限制"模式任务
3. 运行任务
4. 检查数据库：
   - `pairing_mode` 应该是 `'unlimited'`
   - `blue_pairing_indices` 应该是长度为红球数的数组
5. 导出数据：
   - 组合数 = 红球数（不是红球数×66）
   - 每个红球配对一个蓝球（循环配对）

## 修复日期

2025-10-24

## 相关文件

- `E:\HITGUI\src\server\server.js` (line 12523, line 15006)
