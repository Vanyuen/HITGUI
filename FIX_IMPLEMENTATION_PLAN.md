# 热温冷正选任务BUG修复实施方案

**日期**: 2025-11-20
**问题**: 98/101个期号被错误标记为推算期，导致保留组合数为0

---

## 问题根源分析

### 关键发现

1. **缓存被清空**:
   - `processHwcPositiveTask` 在第18355行调用 `globalCacheManager.clearTaskSpecificCache()`
   - 这会清空 `globalCacheManager.issueToIDMap`（第12359-12361行）

2. **判断逻辑依赖空缓存**:
   - 第16840-16842行判断期号是否开奖时，使用的是：
     ```javascript
     const issueExists = (globalCacheManager.issueToIDMap?.has(targetIssue.toString())) ||
                         (this.issueToIdMap?.has(targetIssue.toString()));
     isPredicted = !issueExists;
     ```
   - 如果两个Map都是空的，所有期号都会被判断为推算期！

3. **父类预加载不设置本地映射**:
   - 父类 `StreamBatchPredictor.preloadData()` 不设置 `this.issueToIdMap`
   - 只有 `globalCacheManager.issueToIDMap` 被设置，但立即被清空

---

## 修复方案

### 方案1：在清理缓存后重新加载issueToIDMap（推荐）

**修改位置**: `src/server/server.js:18355` 附近

**修改内容**:

```javascript
// ⚡ 优化2：任务开始前强制清理任务特定缓存，确保干净的缓存环境
globalCacheManager.clearTaskSpecificCache();
log(`🧹 [${taskId}] 任务开始前缓存已清理`);

// ⭐ 修复：重新加载issueToIDMap（被清理后需要恢复）
log(`📥 [${taskId}] 重新加载期号到ID映射...`);
const allIssues = await hit_dlts.find({}).select('Issue ID').lean();
global CacheManager.issueToIDMap = new Map();
for (const record of allIssues) {
    globalCacheManager.issueToIDMap.set(record.Issue.toString(), record.ID);
}
log(`✅ [${taskId}] 期号映射已恢复: ${globalCacheManager.issueToIDMap.size}条记录`);
```

### 方案2：避免清空issueToIDMap

**修改位置**: `src/server/server.js:12359-12361`

**修改内容**:

```javascript
// 原代码：清空issueToIDMap
// if (this.issueToIDMap) {
//     this.issueToIDMap.clear();
// }
// this.issueToIDMap = null;

// ⭐ 修复：不清空issueToIDMap，它是全局的，不应该被清理
// issueToIDMap是全局基础数据，不受任务影响，不应该被清理
log(`ℹ️ [GlobalCache] 保留 issueToIDMap (${this.issueToIDMap?.size || 0}条记录)`);
```

### 方案3：在HwcPositivePredictor中设置本地映射（备选）

**修改位置**: `src/server/server.js:16465` （HwcPositivePredictor.preloadData方法）

**在父类调用后添加**:

```javascript
async preloadData(targetIssues, filters, exclude_conditions, maxRedCombinations, enableValidation) {
    // 1. 调用父类的预加载方法
    await super.preloadData(targetIssues, filters, exclude_conditions, maxRedCombinations, enableValidation);

    // ⭐ 修复：设置本地issueToIdMap（从全局缓存复制）
    if (globalCacheManager.issueToIDMap && globalCacheManager.issueToIDMap.size > 0) {
        this.issueToIdMap = new Map(globalCacheManager.issueToIDMap);
        log(`✅ [${this.sessionId}] 本地期号映射已复制: ${this.issueToIdMap.size}条记录`);
    } else {
        // 全局缓存为空，重新加载
        log(`⚠️ [${this.sessionId}] 全局issueToIDMap为空，重新加载...`);
        const allIssues = await hit_dlts.find({}).select('Issue ID').lean();
        this.issueToIdMap = new Map();
        for (const record of allIssues) {
            this.issueToIdMap.set(record.Issue.toString(), record.ID);
        }
        log(`✅ [${this.sessionId}] 本地期号映射已加载: ${this.issueToIdMap.size}条记录`);
    }

    // 2. 继续原有的期号对生成逻辑...
}
```

---

## 推荐实施：组合方案（方案2 + 方案1部分）

### 步骤1：修改clearTaskSpecificCache

**位置**: `src/server/server.js:12359-12361`

**修改前**:
```javascript
if (this.issueToIDMap) {
    this.issueToIDMap.clear();
}
this.issueToIDMap = null;
```

**修改后**:
```javascript
// ⭐ 2025-11-20修复: issueToIDMap是全局基础数据，不应该被清理
// 避免在任务执行中被清空导致所有期号被误判为推算期
if (this.issueToIDMap) {
    log(`ℹ️ [GlobalCache] 保留 issueToIDMap (${this.issueToIDMap.size}条记录) - 全局基础数据`);
}
// 不再清空 issueToIDMap
```

### 步骤2：添加防御性检查

**位置**: `src/server/server.js:16838` 之前

**添加代码**:
```javascript
// ⭐ 2025-11-20修复: 防御性检查，确保期号映射可用
if ((!globalCacheManager.issueToIDMap || globalCacheManager.issueToIDMap.size === 0) &&
    (!this.issueToIdMap || this.issueToIdMap.size === 0)) {
    log(`⚠️ [${this.sessionId}] 警告: 期号映射表为空，所有期号将被误判为推算期！`);
    log(`  正在重新加载期号映射表...`);

    const allIssues = await hit_dlts.find({}).select('Issue ID').lean();

    // 优先恢复全局缓存
    if (!globalCacheManager.issueToIDMap) {
        globalCacheManager.issueToIDMap = new Map();
    }

    for (const record of allIssues) {
        globalCacheManager.issueToIDMap.set(record.Issue.toString(), record.ID);
    }

    log(`  ✅ 期号映射表已恢复: ${globalCacheManager.issueToIDMap.size}条记录`);
}
```

### 步骤3：增强日志

**位置**: `src/server/server.js:16847`

**修改前**:
```javascript
log(`  📌 期号${targetIssue}: ${isPredicted ? '推算期' : '已开奖'} (来源: ${source})`)
```

**修改后**:
```javascript
log(`  📌 期号${targetIssue}: ${isPredicted ? '推算期' : '已开奖'} (来源: ${source}, globalSize=${globalCacheManager.issueToIDMap?.size || 0}, localSize=${this.issueToIdMap?.size || 0})`)
```

---

## 实施步骤

1. **备份现有代码**:
   ```bash
   copy src\server\server.js src\server\server.js.backup_hwc_fix_20251120
   ```

2. **应用修改**:
   - 修改步骤1（不清空issueToIDMap）
   - 修改步骤2（添加防御性检查）
   - 修改步骤3（增强日志）

3. **重启服务器**:
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm start
   ```

4. **创建测试任务**:
   - 使用相同的条件创建新的热温冷正选任务
   - 期号范围：25025-25125

5. **验证结果**:
   ```bash
   node check-hwc-task-final.js
   ```

   **预期输出**:
   ```
   25025-25124: is_predicted=false, 有组合数据
   25125: is_predicted=true, 有组合数据
   ```

---

## 测试检查点

### 1. 服务器日志检查

启动任务时，应该看到：
```
📥 [hwc-pos-xxx] 重新加载期号到ID映射...
✅ [hwc-pos-xxx] 期号映射已恢复: 2792条记录
```

如果看到警告：
```
⚠️ [xxx] 警告: 期号映射表为空，所有期号将被误判为推算期！
  正在重新加载期号映射表...
  ✅ 期号映射表已恢复: 2792条记录
```
说明防御性检查起作用了。

### 2. 期号判断日志检查

每个期号处理时应该看到：
```
📌 期号25124: 已开奖 (来源: globalCache, globalSize=2792, localSize=0)
📌 期号25125: 推算期 (来源: notFound, globalSize=2792, localSize=0)
```

如果所有期号都是 `notFound`，说明映射表仍然为空。

### 3. 最终结果检查

```bash
node check-hwc-task-final.js
```

应该看到大量期号有组合数据。

---

## 回滚方案

如果修复失败，回滚步骤：

```bash
copy src\server\server.js.backup_hwc_fix_20251120 src\server\server.js
npm start
```

---

## 预期效果

修复后：
- ✅ 25025-25124：标记为已开奖期 (`is_predicted: false`)
- ✅ 25125：标记为推算期 (`is_predicted: true`)
- ✅ 所有已开奖期都有组合数据（数量取决于筛选条件）
- ✅ 推算期也有组合数据

---

## 附录：完整修改代码

### A. 修改 clearTaskSpecificCache

**文件**: `src/server/server.js`
**行号**: 12359-12361

```javascript
// ⭐ 2025-11-20修复: issueToIDMap是全局基础数据，不应该被清理
// 避免在任务执行中被清空导致所有期号被误判为推算期
if (this.issueToIDMap) {
    log(`ℹ️ [GlobalCache] 保留 issueToIDMap (${this.issueToIDMap.size}条记录) - 全局基础数据`);
}
// 注释掉原有的清空代码
// if (this.issueToIDMap) {
//     this.issueToIDMap.clear();
// }
// this.issueToIDMap = null;
```

### B. 添加防御性检查

**文件**: `src/server/server.js`
**行号**: 16838 之前插入

```javascript
// ⭐ 2025-11-20修复: 防御性检查，确保期号映射可用
if ((!globalCacheManager.issueToIDMap || globalCacheManager.issueToIDMap.size === 0) &&
    (!this.issueToIdMap || this.issueToIdMap.size === 0)) {
    log(`⚠️ [${this.sessionId}] 警告: 期号映射表为空，重新加载...`);

    const allIssues = await hit_dlts.find({}).select('Issue ID').lean();

    if (!globalCacheManager.issueToIDMap) {
        globalCacheManager.issueToIDMap = new Map();
    }

    for (const record of allIssues) {
        globalCacheManager.issueToIDMap.set(record.Issue.toString(), record.ID);
    }

    log(`  ✅ 期号映射表已恢复: ${globalCacheManager.issueToIDMap.size}条记录`);
}
```

---

**准备好实施了吗？请确认后我开始修改代码。**
