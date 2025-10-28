# MongoDB优化实施总结

## ✅ 已完成的优化

### 1. 修复连接池配置 ✅

**执行时间**: 2025-10-27

**修改文件**: `src/database/config.js`

**配置内容**:
```javascript
mongoose.connect(uri, {
    maxPoolSize: 10,        // 最大连接数限制为10
    minPoolSize: 2,         // 最小保持2个连接
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4              // 强制使用IPv4
})
```

**预期效果**: 连接数从 303 降至 10-20

**备份文件**: `config.js.backup_1761539216380`

---

## ⏳ 待完成的优化

### 2. 配置WiredTiger缓存限制 (需要手动操作)

**目标**: 将最大缓存从 15.8GB 降至 4GB

**操作步骤**: 参见 `configure-wiredtiger-cache.md`

**简要步骤**:
1. 找到 `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`
2. 添加配置:
   ```yaml
   storage:
     wiredTiger:
       engineConfig:
         cacheSizeGB: 4
   ```
3. 重启MongoDB服务:
   ```powershell
   net stop MongoDB
   net start MongoDB
   ```

**预期效果**: MongoDB内存占用从 9.2GB 降至 3-4GB

---

### 3. 删除冗余索引 (可选，低优先级)

**原因**: 索引删除操作在大型集合上可能需要很长时间

**影响**: 当前索引占用约25MB，删除后可释放约15MB

**建议**:
- ✅ 如果系统运行正常，可以跳过此步骤
- ⚠️ 如果要执行，建议在维护时段进行

**手动执行命令**:
```javascript
// 连接MongoDB
use lottery

// 删除冗余索引
db.hit_dlt_redcombinations.dropIndex("sum_1")
db.hit_dlt_redcombinations.dropIndex("sumRange_1")
db.hit_dlt_redcombinations.dropIndex("zoneRatio_1")
db.hit_dlt_redcombinations.dropIndex("evenOddRatio_1")
db.hit_dlt_redcombinations.dropIndex("consecutiveCount_1")
db.hit_dlt_redcombinations.dropIndex("consecutive_groups_1")
db.hit_dlt_redcombinations.dropIndex("max_consecutive_length_1")
```

---

### 4. 优化排除详情表索引 (可选，低优先级)

**影响**: 可释放约1.5GB索引空间

**建议**: 同上，可选操作

**手动执行命令**:
```javascript
// 连接MongoDB
use lottery

// 删除不常用的条件字段索引
db.hit_dlt_exclusiondetails.dropIndex("sum_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("span_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("zone_ratio_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("odd_even_ratio_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("hot_warm_cold_condition_1")
```

---

## 📊 预期优化效果

| 优化项 | 状态 | 效果 |
|--------|------|------|
| 连接池配置 | ✅ 完成 | 连接数: 303 → 10-20 |
| WiredTiger缓存 | ⏳ 待完成 | 内存: 9.2GB → 3-4GB |
| 删除冗余索引 | 📋 可选 | 释放约15MB空间 |
| 优化排除详情索引 | 📋 可选 | 释放约1.5GB空间 |

**核心优化 (1+2)**: 可将MongoDB内存占用从 9.2GB 降至 3-4GB (减少60%)

---

## 🚀 下一步操作

### 立即执行 (推荐):

1. **配置WiredTiger缓存限制** ⭐
   - 阅读 `configure-wiredtiger-cache.md`
   - 编辑 `mongod.cfg`
   - 重启MongoDB服务

2. **验证优化效果**
   - 运行 `node diagnose-mongodb-usage.js`
   - 检查内存占用是否降低

### 可选执行:

3. **删除冗余索引** (如果需要释放更多空间)
   - 在非高峰期执行
   - 备份数据库
   - 手动执行索引删除命令

---

## ⚠️ 重要说明

### 关于热温冷比优化表

**保留此表！不要删除！**

- **占用**: 9.1 GB
- **原因**: 当初就是因为实时计算导致"批量预测多期时内存不足、运行慢"才做的预处理优化
- **性能**: 查询性能从 3-5秒/期 降至 0.5-1秒/期
- **结论**: 这是必要的性能优化，9GB存储空间换取5-10倍性能提升是值得的

### 优化策略

**核心策略**: 保留热温冷表，优化其他方面

1. ✅ 限制WiredTiger缓存 (最有效)
2. ✅ 修复连接池配置 (已完成)
3. 📋 删除冗余索引 (可选)
4. 📋 清理旧数据 (可选)

**不推荐**: 删除热温冷表或改用实时计算 (会严重影响性能)

---

## 📝 验证清单

完成优化后，运行以下命令验证:

```bash
# 1. 检查MongoDB内存占用
node diagnose-mongodb-usage.js

# 2. 检查连接数
# 应该在10-20之间

# 3. 启动应用测试
npm start

# 4. 测试批量预测功能
# 性能应该保持不变或更好
```

**预期结果**:
- ✅ MongoDB内存占用: 3-4GB
- ✅ 连接数: 10-20
- ✅ 批量预测性能: 保持不变
- ✅ 应用功能: 完全正常

---

## 📞 问题反馈

如果遇到问题:

1. 检查 MongoDB 服务是否正常运行
2. 查看 MongoDB 日志: `C:\data\log\mongod.log`
3. 恢复备份文件: `config.js.backup_*`
4. 重新阅读配置指南

---

**最后更新**: 2025-10-27
**优化状态**: 1/2 核心优化完成，待完成WiredTiger配置
**下一步**: 配置WiredTiger缓存限制并验证效果
