# 数据表更新功能重构方案

## 问题背景

当前"增量更新热温冷优化表"功能存在缺陷：
- 热温冷优化表依赖遗漏值表数据
- 遗漏值表没有增量更新功能
- 导致新期号的遗漏值不存在，热温冷增量更新返回"新建0条记录"

### 数据表依赖关系

```
hit_dlts (开奖数据)
    │
    ├──→ hit_dlt_basictrendchart_redballmissing_histories (红球遗漏值表)
    │         │
    │         └──→ HIT_DLT_RedCombinationsHotWarmColdOptimized (热温冷优化表)
    │
    ├──→ hit_dlt_basictrendchart_blueballmissing_histories (蓝球遗漏值表)
    │
    ├──→ hit_dlt_combofeatures (组合特征表)
    │
    └──→ hit_dlts.statistics (统计字段)
```

### 当前数据状态

| 数据表 | 最新ID/期号 | 状态 |
|--------|-------------|------|
| hit_dlts | ID=2805 (期号25137) | ✅ 已更新 |
| 遗漏值表 | ID=2792 | ❌ 落后13期 |
| 热温冷优化表 | target_issue=25115 | ❌ 落后22期 |

---

## 重构方案

### 目标

将数据更新功能整理为两种模式：

| 模式 | 名称 | 说明 |
|------|------|------|
| **全量更新** | 一键全量更新数据表 | 重建所有衍生数据表，适用于数据修复 |
| **增量更新** | 一键增量更新数据表 | 只处理新增期号，适用于日常更新 |

---

## 详细设计

### 1. 一键全量更新（已有功能，优化整理）

**API**: `POST /api/dlt/unified-update`
**Body**: `{ "mode": "full" }`

**执行步骤**：
1. 全量重建遗漏值表（红球+蓝球）
2. 全量重建组合特征表
3. 全量重建statistics字段
4. 全量重建热温冷优化表
5. 清理过期缓存
6. 验证数据完整性

**适用场景**：
- 数据损坏修复
- 首次初始化
- 算法逻辑变更后重建

---

### 2. 一键增量更新（新功能）

**API**: `POST /api/dlt/unified-update-incremental`

**执行步骤**：
```
步骤1: 检查数据差距
  ├─ 获取 hit_dlts 最新ID
  ├─ 获取遗漏值表最新ID
  ├─ 获取热温冷优化表最新期号
  └─ 计算需要更新的期数

步骤2: 增量更新遗漏值表 [新增功能]
  ├─ 从遗漏值表最新ID开始
  ├─ 继承上一期的遗漏值状态
  └─ 只计算新期号的遗漏值

步骤3: 增量更新热温冷优化表 [已有功能]
  ├─ 从优化表最新期号开始
  └─ 只处理新开奖期+推算期

步骤4: 返回更新结果
  └─ 各表新增记录数和耗时
```

**适用场景**：
- 日常数据更新后的同步
- 新增开奖数据后一键更新所有衍生表

---

### 3. 新增：遗漏值表增量更新函数

```javascript
/**
 * 增量更新遗漏值表
 * 只处理 hit_dlts 中比遗漏值表新的记录
 */
async function incrementalUpdateMissingTables() {
    // 1. 获取遗漏值表最新记录
    const latestMissing = await getLatestMissingRecord();

    // 2. 获取 hit_dlts 中更新的记录
    const newRecords = await hit_dlts.find({ ID: { $gt: latestMissing.ID } })
        .sort({ ID: 1 });

    // 3. 从上一期遗漏值状态继续计算
    const lastMissingState = extractMissingState(latestMissing);

    // 4. 逐期计算新的遗漏值
    for (const record of newRecords) {
        const newMissing = calculateMissing(lastMissingState, record);
        await insertMissingRecord(newMissing);
        updateMissingState(lastMissingState, record);
    }

    return { newRecords: newRecords.length };
}
```

---

### 4. 前端UI调整

**当前UI**（大乐透数据管理后台）：
```
[更新热温冷优化表]     [增量更新热温冷优化表]
```

**调整后UI**：
```
[一键全量更新数据表]   [一键增量更新数据表]
```

**按钮说明**：
- **一键全量更新数据表**：重建所有衍生表（遗漏值、组合特征、统计、热温冷）
- **一键增量更新数据表**：只更新新增期号的数据（推荐日常使用）

---

## 实施步骤

### 阶段1：后端修改

1. **新增函数** `incrementalUpdateMissingTables()`
   - 位置：`src/server/server.js`
   - 功能：遗漏值表增量更新

2. **新增API** `POST /api/dlt/unified-update-incremental`
   - 功能：一键增量更新所有衍生表
   - 步骤：遗漏值表增量 → 热温冷优化表增量

3. **优化现有API**
   - 整理 `/api/dlt/unified-update` 为全量更新专用

### 阶段2：前端修改

1. **修改按钮文案和功能**
   - 位置：`src/renderer/dlt-module.js` 或 `index.html`
   - 将"增量更新热温冷优化表"改为"一键增量更新数据表"
   - 调用新的增量更新API

2. **添加进度提示**
   - 显示各步骤执行状态
   - 显示更新记录数

---

## 预期效果

### 更新前（当前问题）
```
用户操作：点击"增量更新热温冷优化表"
结果：增量更新完成，新建0条记录，耗时150.7秒
原因：遗漏值表未同步，依赖数据缺失
```

### 更新后（修复后）
```
用户操作：点击"一键增量更新数据表"
结果：
  ✅ 遗漏值表增量更新完成，新建13条记录
  ✅ 热温冷优化表增量更新完成，新建22条记录
  总耗时：约30秒
```

---

## 确认事项

请确认以下内容：

1. **功能命名**
   - [ ] "一键全量更新数据表"
   - [ ] "一键增量更新数据表"

2. **更新范围**
   - [ ] 增量更新是否只需更新：遗漏值表 + 热温冷优化表？
   - [ ] 是否需要增量更新：组合特征表、statistics字段？（这两个通常不需要频繁更新）

3. **UI位置**
   - [ ] 保持在"大乐透数据管理后台"页面
   - [ ] 或移动到其他位置？

4. **其他需求**
   - [ ] 是否需要添加更新前的数据检查/预览？
   - [ ] 是否需要添加更新日志记录？

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/server/server.js` | 新增 `incrementalUpdateMissingTables()` 函数 |
| `src/server/server.js` | 新增 `/api/dlt/unified-update-incremental` API |
| `src/renderer/dlt-module.js` | 修改按钮调用逻辑 |
| `src/renderer/index.html` | 修改按钮文案（如需要） |

---

**请确认方案是否符合预期，我将在您确认后开始实施。**
