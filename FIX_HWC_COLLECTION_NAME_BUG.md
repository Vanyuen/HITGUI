# 热温冷正选批量预测BUG修复方案

## 问题诊断结果

### 1. 根本原因
**集合名称不匹配导致查询失败**

- ❌ **代码中使用的集合名** (server.js:512)：
  ```javascript
  mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', schema)
  // MongoDB会自动将其转换为: hit_dlt_redcombinationshotwarmcoldoptimized (小写单数)
  ```

- ✅ **实际数据存储的集合名**：
  ```
  hit_dlt_redcombinationshotwarmcoldoptimizeds (小写复数，有2792条记录)
  ```

### 2. 数据验证
**HWC数据完整存在**，包括所有期号对的数据：
- 25114 → 25115: ✅ 48,450个4:1:0组合
- 25115 → 25116: ✅ 21,840个4:1:0组合
- 25116 → 25117: ✅ 27,540个4:1:0组合
- 25123 → 25124: ✅ 18,360个4:1:0组合
- 25124 → 25125: ✅ 18,360个4:1:0组合

### 3. 问题表现
- 除25125外所有期号显示0组合
- 25115误判为"推算"期（实际是历史期）

## 修复方案

### 方案A：修正模型定义（推荐）
修改 `server.js:512` 行，显式指定正确的集合名：

```javascript
// 原代码（错误）
const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    dltRedCombinationsHotWarmColdOptimizedSchema
);

// 修复后（正确）
const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    dltRedCombinationsHotWarmColdOptimizedSchema,
    'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 显式指定集合名
);
```

### 方案B：数据迁移（备选）
将数据从 `hit_dlt_redcombinationshotwarmcoldoptimizeds` 迁移到 `hit_dlt_redcombinationshotwarmcoldoptimized`

## 实施步骤

1. **备份 server.js**
2. **修改模型定义**（第512行）
3. **修复期号判断逻辑**（确保历史期号不被误判为推算）
4. **重启服务器**
5. **验证修复效果**

## 验证方法

```bash
# 1. 创建测试任务
curl -X POST http://localhost:3003/api/dlt/hwc-positive-prediction-task/create \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "修复验证测试",
    "period_range": {
      "type": "custom",
      "start": "25115",
      "end": "25125"
    },
    "positive_selection": {
      "red_hot_warm_cold_ratios": [{"hot": 4, "warm": 1, "cold": 0}]
    }
  }'

# 2. 检查结果
# - 25115-25124应显示正常组合数（非0）
# - 25125标记为"推算"
# - 其他期号不应标记为"推算"
```

## 风险评估

- **低风险**：仅修改集合名映射，不影响业务逻辑
- **无数据丢失**：数据保持在原集合中
- **可回滚**：如有问题可恢复原代码

## 预期结果

修复后：
1. ✅ 所有历史期号（25115-25124）显示正确的组合数
2. ✅ 仅25125标记为"推算"期
3. ✅ HWC数据正确查询和使用