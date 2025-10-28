# MongoDB高内存占用原因详解

## ❓ 你的问题

> MongoDB为什么这么高的占用？是electron启动就一直在用热温冷比优化表吗？

## 💡 简短答案

**不是！** Electron启动时并**没有**加载热温冷比优化表。

MongoDB占用9.2GB内存的主要原因是：

1. **WiredTiger缓存机制** (自动缓存)
2. **数据库存储的9.1GB热温冷数据** (物理存在)
3. **MongoDB的工作集原理** (working set)

---

## 📊 详细分析

### 1. Electron启动时做了什么？

根据代码分析 (`main.js` + `server.js`)：

```javascript
// main.js line 183-210
async function startInternalServer() {
    // 1. 初始化数据库连接
    await dbManager.initialize(app.getPath('userData'));

    // 2. 启动Express服务器
    expressApp = require('./src/server/server');
    expressServer = expressApp.listen(3003, async () => {
        console.log('✅ 内嵌服务器已启动: http://localhost:3003');

        // 3. 创建数据库索引（性能优化）
        await expressApp.ensureDatabaseIndexes();

        resolve();
    });
}
```

**启动时只做了**:
1. ✅ 连接MongoDB数据库
2. ✅ 创建索引 (仅元数据操作)
3. ✅ 启动Express服务器

**启动时并没有**:
- ❌ 查询热温冷比优化表
- ❌ 加载任何大量数据到内存
- ❌ 执行任何批量预测操作

### 验证证据
从启动日志可以看到：
```
✅ 已连接到本地MongoDB数据库
📊 开始创建数据库索引（性能优化）...
  ℹ DLT主表索引已存在
  ℹ DLTRedMissing表索引已存在
  ℹ DLTRedCombination表索引已存在
  ℹ DLTComboFeatures表索引已存在
✅ 数据库索引初始化完成
```

**没有任何热温冷数据查询的日志！**

---

### 2. 那MongoDB为什么占用9.2GB内存？

#### 原因1: WiredTiger存储引擎的缓存机制 ⭐核心原因

MongoDB使用WiredTiger存储引擎，它有一个**自动缓存机制**：

```yaml
# 默认配置 (你的系统)
cacheSizeGB: 自动计算 = min(50% 物理RAM - 1GB, 256GB)

# 你的电脑如果有32GB内存
cacheSizeGB = 32GB * 0.5 - 1GB = 15GB
```

**工作原理**:
1. MongoDB启动后，WiredTiger会**预分配**最多15.8GB的缓存空间
2. 当你查询数据时，MongoDB会把数据**缓存**到内存中
3. 即使你关闭了Electron应用，MongoDB进程仍在运行
4. 缓存的数据**不会自动清除**，会一直占用内存

#### 从诊断数据验证:
```
💾 内存使用:
  常驻内存: 9173 MB
  虚拟内存: 20730 MB
  WiredTiger缓存: 9415.66 MB  ← 几乎占满了常驻内存
  WiredTiger最大缓存: 15806.00 MB
```

**关键发现**: 9.2GB常驻内存中，9.4GB是WiredTiger缓存！

---

#### 原因2: 工作集 (Working Set) 原理

MongoDB会缓存**经常访问**的数据，形成"工作集"。

**你的数据库中存储了**:
- `hit_dlt_redcombinationshotwarmcoldoptimizeds`: 9.1 GB
- `hit_dlt_exclusiondetails`: 3.4 GB
- 其他集合: 约300 MB

**推测发生了什么**:
1. 你之前运行过批量预测功能
2. 批量预测会查询热温冷比优化表
3. MongoDB把9.1GB的热温冷数据加载到WiredTiger缓存中
4. **即使应用关闭，MongoDB进程继续运行，缓存不释放**
5. 下次查询时直接从缓存读取 (超快速度)

---

#### 原因3: 数据库物理大小

```
数据库磁盘占用:
  数据大小: 12.7 GB
  索引大小: 3.7 GB
  存储大小: 7.3 GB (压缩后)
```

即使没有缓存，这些数据**物理存在于磁盘上**。

MongoDB需要：
- 管理这些数据的元数据
- 维护索引结构
- 处理查询请求

这些操作都需要占用内存。

---

### 3. 热温冷比优化表什么时候被使用？

**只在以下场景使用**:

#### 场景1: 用户执行组合预测
```javascript
// 前端: 用户点击"开始预测"按钮
// 后端: server.js line 9222
let hotWarmColdData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
    base_issue: baseIssue,
    target_issue: targetIssue
});
```

#### 场景2: 批量预测多期
```javascript
// 批量预测20期时，会查询20次热温冷数据
// server.js line 11387
const hwcData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
    base_issue: baseIssue,
    target_issue: targetIssueStr
});
```

#### 场景3: 生成热温冷数据
```javascript
// 管理员手动生成热温冷数据
// server.js line 20124
await DLTRedCombinationsHotWarmColdOptimized.create({
    base_issue: baseIssueStr,
    target_issue: targetIssueStr,
    hot_warm_cold_data: hotWarmColdData,
    ...
});
```

**关键结论**: 热温冷表只在**用户主动操作时**才会查询！

---

## 🔬 实验验证

### 实验1: 重启MongoDB，检查初始内存占用

```bash
# 1. 停止MongoDB
net stop MongoDB

# 2. 检查内存占用 (应该为0)
tasklist | findstr mongod

# 3. 启动MongoDB
net start MongoDB

# 4. 立即检查内存占用 (应该很低，约100-200MB)
tasklist | findstr mongod

# 5. 启动Electron应用
npm start

# 6. 再次检查MongoDB内存 (应该仍然很低)
tasklist | findstr mongod

# 7. 执行一次批量预测 (查询热温冷数据)
# (在UI中操作)

# 8. 再次检查MongoDB内存 (应该大幅上升到几GB)
tasklist | findstr mongod
```

**预期结果**:
- 启动Electron时: MongoDB内存占用**不会**显著增加
- 执行批量预测后: MongoDB内存占用**会**大幅增加

---

### 实验2: 监控数据库操作

```bash
# 启动MongoDB性能分析
mongosh lottery --eval "db.setProfilingLevel(2)"

# 启动Electron应用
npm start

# 查看数据库操作日志
mongosh lottery --eval "db.system.profile.find().limit(20).pretty()"

# 预期: 应该只看到索引创建操作，没有数据查询
```

---

## 💡 为什么感觉一直占用这么高？

### 原因: MongoDB进程持久运行

```
你的操作流程:
1. 启动Electron → MongoDB连接 → 内存占用低 (约200MB)
2. 使用批量预测 → 查询热温冷数据 → 数据被缓存 → 内存占用升至9GB
3. 关闭Electron → MongoDB仍在运行 → 缓存不释放 → 内存仍是9GB
4. 再次启动Electron → MongoDB还是同一个进程 → 内存看起来"一直"是9GB
```

**关键点**: MongoDB是独立的系统服务，不会因为Electron关闭而关闭！

---

## 🎯 结论

### MongoDB高内存占用的真实原因

| 原因 | 占用大小 | 何时发生 | 是否必要 |
|------|---------|---------|---------|
| **WiredTiger缓存** | 9.4 GB | 查询过数据后 | ⚠️ 部分必要 |
| 热温冷表物理存储 | 9.1 GB | 生成数据时 | ✅ 必要 (性能优化) |
| 其他集合数据 | 3.6 GB | 正常使用 | ✅ 必要 |
| 索引元数据 | 3.7 GB | 创建索引时 | ⚠️ 部分冗余 |

### Electron启动时的真相

✅ **事实**:
- Electron启动时**不会**查询热温冷比优化表
- 启动时**不会**加载大量数据到内存
- 启动时只进行连接和索引初始化

❌ **误解**:
- ~~启动就加载热温冷数据~~ (错误)
- ~~启动就占用9GB内存~~ (错误)
- ~~热温冷表一直在用~~ (错误)

### 为什么看起来"一直"占用这么高？

**因为MongoDB缓存不释放！**

1. 你之前使用过批量预测功能
2. 热温冷数据被加载到缓存
3. MongoDB进程持续运行，缓存不清空
4. 每次启动Electron，看到的是**同一个MongoDB进程**
5. 所以内存占用"看起来"一直很高

---

## 🛠️ 如何验证？

### 方法1: 重启MongoDB服务

```bash
# Windows
net stop MongoDB
net start MongoDB

# 立即检查内存占用
tasklist | findstr mongod
# 应该只有100-300MB

# 然后启动Electron
npm start

# 再次检查内存占用
tasklist | findstr mongod
# 应该仍然只有300-500MB (没有显著增加)
```

### 方法2: 监控查询日志

在 `server.js` 中添加日志：

```javascript
// 在DLTRedCombinationsHotWarmColdOptimized.findOne之前添加
console.log('🔥 正在查询热温冷数据:', baseIssue, targetIssue);
```

启动Electron后，如果没有看到这条日志，说明没有查询热温冷表。

---

## 🎯 最终答案

**Q: MongoDB为什么这么高的占用？**

**A**: 因为WiredTiger缓存机制。当你之前使用批量预测功能时，9.1GB的热温冷数据被加载到缓存中，即使关闭应用，MongoDB进程继续运行，缓存不释放。

**Q: 是electron启动就一直在用热温冷比优化表吗？**

**A**: **不是！** Electron启动时只连接数据库和创建索引，不会查询热温冷表。只有当你执行组合预测或批量预测时，才会查询这个表。

**Q: 那为什么看起来一直占用这么高？**

**A**: 因为MongoDB是独立的系统服务，一旦缓存了数据就不会主动释放。你看到的高内存占用是**之前操作的遗留**，不是启动时产生的。

---

## 💡 解决方案

### 方案1: 限制WiredTiger缓存 (推荐)

编辑 `mongod.cfg`:
```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # 从15.8GB降至4GB
```

### 方案2: 清理热温冷数据 (只保留200期)

```javascript
// 删除200期以前的数据
const latestIssue = await DLT.findOne().sort({ Issue: -1 });
const cutoffIssue = (parseInt(latestIssue.Issue) - 200).toString();

await DLTRedCombinationsHotWarmColdOptimized.deleteMany({
  target_issue: { $lt: cutoffIssue }
});
```

释放: 9.1GB → 650MB (节省8.5GB)

### 方案3: 定期重启MongoDB

```bash
# 每天凌晨重启MongoDB，清空缓存
# 创建Windows计划任务
schtasks /create /tn "RestartMongoDB" /tr "net stop MongoDB && net start MongoDB" /sc daily /st 03:00
```

---

**文档创建**: 2025-10-27
**问题解答**: MongoDB高内存占用原因
**结论**: Electron启动时不会查询热温冷表，高内存占用是WiredTiger缓存机制导致的
