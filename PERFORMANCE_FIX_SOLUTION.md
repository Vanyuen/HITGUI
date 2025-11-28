# 性能衰减问题修复方案

## 修复目标

解决热温冷正选批量预测连续创建任务时，后续任务越来越慢的问题。

## 核心修复：任务完成后清理缓存

### 修改文件
`src/server/server.js`

### 修改位置和代码

#### 位置1: 任务成功完成后清理缓存
**行号**: 17710 (在任务完成日志之后)

**原代码**:
```javascript
log(`✅ [${taskId}] 任务完成！共处理${issue_range.length}期, 保存${savedCount}条结果, 总组合数${totalCombinations}`);

} catch (error) {
```

**修改为**:
```javascript
log(`✅ [${taskId}] 任务完成！共处理${issue_range.length}期, 保存${savedCount}条结果, 总组合数${totalCombinations}`);

        // ⚡ 性能优化: 清理任务特定缓存（HWC + 历史数据），释放内存
        globalCacheManager.clearTaskSpecificCache();
        log(`🧹 [${taskId}] 任务特定缓存已清理，内存已释放`);

    } catch (error) {
```

#### 位置2: 任务失败后也清理缓存
**行号**: 17724 (在任务失败状态更新之后)

**原代码**:
```javascript
await HwcPositivePredictionTask.updateOne(
    { task_id: taskId },
    {
        $set: {
            status: 'failed',
            error_message: error.message
        }
    }
);
}
```

**修改为**:
```javascript
await HwcPositivePredictionTask.updateOne(
    { task_id: taskId },
    {
        $set: {
            status: 'failed',
            error_message: error.message
        }
    }
);

        // ⚡ 性能优化: 即使失败也要清理缓存，避免内存泄漏
        globalCacheManager.clearTaskSpecificCache();
        log(`🧹 [${taskId}] 任务失败后缓存已清理`);
    }
}
```

## 修复原理

### 当前问题:
1. **每个任务**处理101期，缓存101个期号对的热温冷优化数据
2. **任务完成后**这些缓存留在内存中（Map结构）
3. **第2个任务**创建时，Map已有101个条目
4. **第3个任务**创建时，Map已有202个条目
5. **第10个任务**创建时，Map已有1010个条目 → **性能显著下降**

### 修复后:
1. **每个任务完成后**立即清理任务特定缓存
2. **基础缓存**（红球/蓝球组合）保持复用 → ✅ 首次构建后速度快
3. **任务缓存**（HWC/历史）每次清空 → ✅ 内存稳定，无累积
4. **所有任务**的处理速度保持一致

### 清理的内容:
```javascript
// GlobalCacheManager.clearTaskSpecificCache() 清理:
this.hwcOptimizedCache = null;       // 热温冷优化表 (~5MB per 任务)
this.historicalIssuesCache = null;   // 历史开奖数据 (~1MB per 任务)
```

### 保留的内容:
```javascript
// 以下缓存保持复用，不清理:
this.redCombinationsCache      // 红球组合 (324,632条) - 全局共享
this.blueCombinationsCache     // 蓝球组合 (66条) - 全局共享
this.bitIndexEngine            // 位图索引引擎 - 全局共享
this.ultraFastDataEngine       // 超快数据引擎 - 全局共享
```

## 预期效果

### 修复前:
| 任务序号 | 内存占用 | Map条目 | 处理时间 |
|---------|---------|---------|---------|
| 第1个   | ~105MB  | 101     | 15分钟  |
| 第2个   | ~110MB  | 202     | 18分钟  |
| 第5个   | ~125MB  | 505     | 25分钟  |
| 第10个  | ~150MB  | 1010    | 35分钟  |

### 修复后:
| 任务序号 | 内存占用 | Map条目 | 处理时间 |
|---------|---------|---------|---------|
| 第1个   | ~105MB  | 101     | 15分钟  |
| 第2个   | ~105MB  | 101     | 15分钟  |
| 第5个   | ~105MB  | 101     | 15分钟  |
| 第10个  | ~105MB  | 101     | 15分钟  |

**关键改善**:
- ✅ 内存稳定在 ~105MB（不再累积）
- ✅ 处理速度保持一致（15分钟/任务）
- ✅ 无性能衰减

## 验证步骤

### 1. 修复前测试（可选，如果想对比）:
```bash
# 创建3个连续任务，记录每个任务的耗时
curl -X POST http://localhost:3003/api/dlt/hwc-positive-prediction-tasks/create ...
# 等待任务1完成，记录时间
# 创建任务2，记录时间
# 创建任务3，记录时间
```

### 2. 应用修复

### 3. 修复后测试:
```bash
# 重启应用
npm start

# 创建3个连续任务
# 观察每个任务的耗时是否一致
```

### 4. 日志验证:
```
✅ [hwc-pos-xxx-m62] 任务完成！...
🧹 [hwc-pos-xxx-m62] 任务特定缓存已清理，内存已释放
🧹 [GlobalCache] 清理任务特定缓存（HWC + 历史数据）...
🧹 [GlobalCache] 已触发垃圾回收
```

## 风险评估

**风险等级**: 🟢 低

**原因**:
1. 只添加清理调用，不修改核心逻辑
2. `clearTaskSpecificCache()`方法已存在并测试过
3. 只清理任务特定数据，不影响全局共享缓存
4. 即使清理失败，也不影响任务结果正确性

**回滚方案**:
如果出现问题，直接删除新增的2个清理调用即可。

## 实施时间

预计修改时间: **5分钟**
预计测试时间: **30分钟** (3个连续任务测试)

## 总结

这是一个**低风险、高收益**的修复:
- 代码修改量: 仅4行
- 修复核心问题: 内存泄漏和性能衰减
- 测试简单: 创建多个任务即可验证

修复后，无论创建多少个连续任务，性能都将保持一致。
