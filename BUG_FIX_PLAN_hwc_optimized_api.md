# BUG修复方案：热温冷优化表增量更新API缺失

## 问题描述

### 错误信息
```
[09:40:50] ⚡ 开始增量更新热温冷优化表...
[09:40:50] ❌ 网络错误: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

### 根本原因

**后端 `server.js` 中缺少以下两个 API 路由：**

1. `/api/dlt/hwc-optimized/update-incremental` - 增量更新
2. `/api/dlt/hwc-optimized/rebuild-all` - 全量重建

前端 `admin.js` 调用这两个 API（第496行和第525行），但后端未定义这些路由。
当请求一个不存在的路由时，Express 返回 HTML 404 页面，导致 `response.json()` 解析失败。

### 受影响功能

| 功能 | 前端位置 | 调用API | 状态 |
|------|----------|---------|------|
| 增量更新热温冷优化表 | admin.js:496 | `/api/dlt/hwc-optimized/update-incremental` | ❌ 缺失 |
| 全量重建热温冷优化表 | admin.js:525 | `/api/dlt/hwc-optimized/rebuild-all` | ❌ 缺失 |

---

## 解决方案

### 方案概述

在 `server.js` 中添加两个新的 API 路由，复用现有的 `generate-hwc-optimized-table.js` 脚本逻辑。

### 实现细节

#### 1. 增量更新 API (`/api/dlt/hwc-optimized/update-incremental`)

**功能描述：**
- 删除推算期（is_predicted=true）的记录
- 删除最近10期的热温冷优化记录
- 重新生成这些期号的热温冷比数据

**实现逻辑：**
```javascript
app.post('/api/dlt/hwc-optimized/update-incremental', async (req, res) => {
    try {
        log('⚡ 开始增量更新热温冷优化表...');

        // 1. 获取最新的10期已开奖期号
        const latestIssues = await hit_dlts.find({})
            .sort({ Issue: -1 })
            .limit(11)  // 需要11期来构建10个期号对
            .select('Issue ID')
            .lean();

        if (latestIssues.length < 2) {
            return res.json({ success: false, message: '数据不足' });
        }

        // 2. 删除推算期记录
        const HwcOptimized = mongoose.connection.db.collection(
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );
        await HwcOptimized.deleteMany({ is_predicted: true });

        // 3. 删除最近10期的记录
        const issuesToDelete = latestIssues.map(i => i.Issue);
        await HwcOptimized.deleteMany({
            $or: [
                { base_issue: { $in: issuesToDelete } },
                { target_issue: { $in: issuesToDelete } }
            ]
        });

        // 4. 重新生成这些期号对的热温冷比数据
        // ... 调用 generateHwcOptimizedData 逻辑

        res.json({ success: true, message: `增量更新完成，已重新生成${count}条记录` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
```

#### 2. 全量重建 API (`/api/dlt/hwc-optimized/rebuild-all`)

**功能描述：**
- 删除整个热温冷优化表的所有数据
- 根据所有历史期号重新生成全部记录
- 预计耗时5-10分钟

**实现逻辑：**
```javascript
app.post('/api/dlt/hwc-optimized/rebuild-all', async (req, res) => {
    try {
        log('🔄 开始全量重建热温冷优化表...');

        // 1. 获取所有历史期号
        const allIssues = await hit_dlts.find({})
            .sort({ ID: 1 })
            .select('Issue ID')
            .lean();

        // 2. 清空现有表
        const HwcOptimized = mongoose.connection.db.collection(
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );
        await HwcOptimized.deleteMany({});

        // 3. 构建期号对并批量生成
        // ... 调用 generateHwcOptimizedData 逻辑

        res.json({ success: true, message: `全量重建完成，共生成${count}条记录` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
```

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/server/server.js` | 添加两个新API路由 |

---

## 关键依赖

需要在 `server.js` 中复用或内联以下函数：

1. **热温冷比计算函数** - `calculateHotColdRatioByMissing(combination, missingData)`
   - 规则：missing ≤ 4 为热，5-9 为温，≥10 为冷

2. **数据集合**
   - `hit_dlts` - 大乐透历史数据
   - `hit_dlt_redcombinations` - 红球组合表（324,632条）
   - `hit_dlt_basictrendchart_redballmissing_histories` - 红球遗漏值表
   - `hit_dlt_redcombinationshotwarmcoldoptimizeds` - 热温冷优化表（目标表）

---

## 注意事项

1. **性能考虑**：全量重建需处理2791个期号对，每个期号对需计算324,632个组合的热温冷比，建议：
   - 使用异步处理，立即返回任务ID
   - 通过 Socket.IO 推送进度
   - 或者分批处理避免超时

2. **数据一致性**：增量更新时需确保遗漏值表已更新到最新

3. **集合名称**：使用小写复数形式 `hit_dlt_redcombinationshotwarmcoldoptimizeds`

---

## 用户确认

请确认以上方案后，我将开始实施修复。主要工作：

1. 在 `server.js` 中添加 `/api/dlt/hwc-optimized/update-incremental` 路由
2. 在 `server.js` 中添加 `/api/dlt/hwc-optimized/rebuild-all` 路由
3. 内联必要的热温冷比计算逻辑
