# 集合命名规范与数据库维护指南

## 📋 核心数据表命名规范

### ⭐ 极其重要：热温冷优化表

**正确集合名（必须严格遵守）**：
```
hit_dlt_redcombinationshotwarmcoldoptimizeds
```

**命名规则**：
1. ✅ 必须使用复数形式：`optimizeds` (末尾有's')
2. ✅ 必须全小写
3. ✅ 必须使用完整单词：`hotwarmcold` (不要缩写为`hwc`)
4. ✅ 必须包含前缀：`hit_dlt_`

**常见错误（禁止使用）**：
- ❌ `hit_dlt_redcombinationshotwarmcoldoptimized` - 缺少's'
- ❌ `hit_dlt_redcombinationshotwarmcolds` - 缺少'optimized'
- ❌ `hit_dlt_hwcoptimized` - 使用了缩写
- ❌ `HIT_DLT_RedCombinationsHotWarmColdOptimized` - 大写
- ❌ `dltredcombinationshotwarmcoldoptimizeds` - 缺少前缀

### 📊 所有核心集合列表

| 集合名 | 记录数（期望） | 更新频率 | 备份策略 |
|--------|----------------|----------|----------|
| `hit_dlts` | 2792+ | 每期新增 | 不需要 |
| `hit_dlt_redcombinations` | 324,632 | 固定 | 不需要 |
| `hit_dlt_bluecombinations` | 66 | 固定 | 不需要 |
| `hit_dlt_basictrendchart_redballmissing_histories` | 2792+ | 每期更新 | 不需要 |
| `hit_dlt_combofeatures` | 2792+ | 每期更新 | 不需要 |
| **`hit_dlt_redcombinationshotwarmcoldoptimizeds`** | **2792+** | **每期更新** | **✅ 必须** |

## 🔧 代码使用规范

### ✅ 正确用法（使用常量）

```javascript
const { COLLECTIONS } = require('./constants/collections');

// 查询数据
const data = await db.collection(COLLECTIONS.HWC_OPTIMIZED).find({}).toArray();

// Mongoose Model 定义
const HWCOptimized = mongoose.model(
  'HWCOptimized',
  schema,
  COLLECTIONS.HWC_OPTIMIZED  // 第三个参数指定集合名
);
```

### ❌ 错误用法（硬编码）

```javascript
// ❌ 禁止硬编码
const data = await db.collection('hit_dlt_hwcoptimized').find({});

// ❌ 禁止使用错误的集合名
const data = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized').find({});
```

## 💾 备份与恢复

### 自动备份机制

**备份时机**：
1. 全量重建前自动备份
2. 每日凌晨2点自动备份
3. 手动触发备份

**手动备份**：
```bash
node backup-hwc-optimized-table.js manual
```

**备份命名格式**：
```
hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_YYYYMMDD_HHMMSS
```

**示例**：
```
hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_20251121_020000
```

### 备份保留策略

- 日备份：保留最近 7 天
- 周备份：保留最近 4 周
- 月备份：保留最近 12 个月

### 恢复数据

```bash
node restore-hwc-optimized-table.js --backup=20251121_020000
```

## 🧹 维护任务

### 清理错误的空集合

```bash
node cleanup-wrong-collections.js
```

此脚本会删除所有空的错误集合（如`hit_dlt_hwcoptimized`等）。

### 验证数据完整性

```bash
node verify-hwc-collection-exists.js
```

## 📊 监控机制

### 启动时检查

服务器启动时自动检查关键集合：

```javascript
async function validateCollections() {
  const required = [
    { name: COLLECTIONS.HIT_DLTS, minCount: 2792 },
    { name: COLLECTIONS.HWC_OPTIMIZED, minCount: 2792 },
    { name: COLLECTIONS.RED_COMBINATIONS, minCount: 324632 },
  ];

  for (const coll of required) {
    const count = await db.collection(coll.name).countDocuments();
    if (count < coll.minCount) {
      console.error(`❌ [启动检查] 集合 ${coll.name} 数据不足: ${count} < ${coll.minCount}`);
      // 发送告警通知
    } else {
      console.log(`✅ [启动检查] 集合 ${coll.name}: ${count}条`);
    }
  }
}
```

### 定时监控

每小时检查一次优化表状态：

```javascript
setInterval(async () => {
  const count = await db.collection(COLLECTIONS.HWC_OPTIMIZED).countDocuments();
  const latest = await db.collection(COLLECTIONS.HWC_OPTIMIZED)
    .find({}).sort({ target_issue: -1 }).limit(1).toArray();

  console.log(`[监控] 热温冷优化表: ${count}条, 最新期号: ${latest[0]?.target_issue}`);

  if (count < 2792) {
    console.error('❌ [告警] 热温冷优化表数据不足！');
    // 发送告警通知
  }
}, 3600000); // 每小时
```

## 🔍 故障排查

### 问题：检测到热温冷优化表数据为0

**可能原因**：
1. 使用了错误的集合名（如`hit_dlt_hwcoptimized`）
2. 代码中硬编码了错误的集合名
3. Mongoose Model 定义未指定正确的集合名

**诊断步骤**：

```bash
# 1. 检查所有相关集合
node analyze-hwc-collection-naming-confusion.js

# 2. 验证正确的集合是否有数据
node verify-with-numeric-sort.js

# 3. 搜索代码中的引用
grep -r "hotwarmcold" src/server/server.js
```

**修复方法**：

1. 将所有硬编码的集合名替换为常量引用
2. 确保Mongoose Model定义使用正确的集合名
3. 重启服务器使更改生效

### 问题：最新期号显示为旧数据（如9152→9153）

**原因**：MongoDB字符串字段按字典序排序，导致 `"25124" < "9152"`

**解决方案**：将字符串转为数字后排序

```javascript
// ❌ 错误（字典序排序）
const latest = await db.collection(COLLECTIONS.HWC_OPTIMIZED)
  .find({}).sort({ target_issue: -1 }).limit(1).toArray();

// ✅ 正确（数字排序）
const allDocs = await db.collection(COLLECTIONS.HWC_OPTIMIZED).find({}).toArray();
allDocs.sort((a, b) => parseInt(b.target_issue) - parseInt(a.target_issue));
const latest = allDocs[0];
```

## 📚 相关文档

- [热温冷正选批量预测功能设计文档](./热温冷正选批量预测-功能设计文档.md)
- [热温冷优化表集合命名混淆分析与解决方案](./HWC_COLLECTION_NAMING_CONFUSION_ANALYSIS_AND_SOLUTION.md)
- [全量重建成功报告](./FULL_REBUILD_SUCCESS_REPORT_20251121.md)

## ⚠️ 重要提醒

1. **绝对禁止**在代码中硬编码集合名
2. **必须使用**`constants/collections.js`中定义的常量
3. **全量重建前**必须先备份
4. **定期检查**备份是否正常执行
5. **监控告警**及时响应数据异常

---

**创建时间**: 2025-11-21
**维护者**: 开发团队
**最后更新**: 2025-11-21
