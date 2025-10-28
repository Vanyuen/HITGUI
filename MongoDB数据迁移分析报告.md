# MongoDB 数据迁移分析报告

## 当前状态总结

### 1. MongoDB 配置状态
- **服务状态**: 正在运行 (Running)
- **MongoDB 版本**: 8.0
- **安装位置**: `C:\Program Files\MongoDB\Server\8.0\bin`
- **配置文件**: `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg`

### 2. 数据存储位置

#### E盘（当前生产数据）✅
- **数据目录**: `E:\Program Files\MongoDB\Server\8.0\data`
- **日志目录**: `E:\Program Files\MongoDB\Server\8.0\log`
- **状态**: **这是当前MongoDB正在使用的活动数据库**
- **配置项**:
  ```yaml
  storage:
    dbPath: E:\Program Files\MongoDB\Server\8.0\data
    wiredTiger:
      engineConfig:
        cacheSizeGB: 4
  systemLog:
    path: E:\Program Files\MongoDB\Server\8.0\log\mongod.log
  ```

#### C盘（旧数据/测试数据）⚠️
- **数据目录**: `C:\data\db`
- **状态**: **包含旧的数据文件（已不再使用）**
- **文件**: 包含大量 `.wt` 文件（WiredTiger 存储引擎文件）

## 问题分析

**好消息**: MongoDB 的主数据已经配置在 E 盘，当前正在使用的是 E 盘数据！

**需要处理**: C 盘仍然保留了旧的数据文件 (`C:\data\db`)，占用C盘空间。

## 迁移方案

### 方案概述
由于数据已经在E盘运行，我们只需要：
1. 备份C盘旧数据（以防万一）
2. 清理C盘旧数据目录

### 详细步骤

#### 步骤1: 验证E盘数据完整性
```bash
# 连接MongoDB并检查数据
mongosh --eval "show dbs"
mongosh lottery --eval "db.getCollectionNames()"
```

**验证要点**:
- 确认 `lottery` 数据库存在
- 确认关键集合存在：`HIT_DLT`, `HIT_UnionLotto`, `PredictionTask` 等

#### 步骤2: 备份C盘旧数据（可选但推荐）
```powershell
# 创建备份目录
New-Item -ItemType Directory -Path "E:\MongoDB_Backup_C_Drive_Old" -Force

# 压缩备份C盘数据
Compress-Archive -Path "C:\data\db" -DestinationPath "E:\MongoDB_Backup_C_Drive_Old\C_data_db_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
```

**预估时间**: 5-15分钟（取决于数据大小）

#### 步骤3: 停止MongoDB服务
```powershell
# 以管理员权限运行
Stop-Service MongoDB

# 验证服务已停止
Get-Service MongoDB
```

#### 步骤4: 清理C盘旧数据
```powershell
# 方案A: 删除整个旧数据目录
Remove-Item "C:\data" -Recurse -Force

# 方案B: 仅删除db子目录（保留C:\data目录结构）
Remove-Item "C:\data\db" -Recurse -Force
```

#### 步骤5: 重启MongoDB服务
```powershell
# 启动服务
Start-Service MongoDB

# 验证服务运行正常
Get-Service MongoDB

# 检查日志
Get-Content "E:\Program Files\MongoDB\Server\8.0\log\mongod.log" -Tail 20
```

#### 步骤6: 验证应用正常运行
```bash
# 测试应用
cd E:\HITGUI
npm start

# 检查端口
netstat -ano | findstr ":27017"
netstat -ano | findstr ":3003"
```

## 风险评估

| 风险项 | 等级 | 说明 | 缓解措施 |
|--------|------|------|----------|
| 数据丢失 | 低 | E盘数据是当前活动数据，C盘为旧数据 | 执行步骤2备份C盘数据 |
| 服务无法启动 | 极低 | 配置文件已正确指向E盘 | 检查配置文件，备份配置 |
| 应用连接失败 | 极低 | 连接配置未改变 | 验证步骤6 |

## 预期收益

1. **释放C盘空间**: 预计释放 0.5-2 GB 空间（取决于C盘旧数据大小）
2. **简化管理**: 统一数据存储在E盘
3. **避免混淆**: 消除旧数据目录，防止误操作

## 回滚方案

如果迁移后出现问题，可以立即回滚：

```powershell
# 1. 停止服务
Stop-Service MongoDB

# 2. 恢复C盘备份（如果删除前已备份）
Expand-Archive -Path "E:\MongoDB_Backup_C_Drive_Old\*.zip" -DestinationPath "C:\data"

# 3. （如需切回C盘）修改配置文件
# 编辑 C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg
# 将 dbPath 改回 C:\data\db

# 4. 重启服务
Start-Service MongoDB
```

## 推荐执行时间

- **最佳时间**: 应用无用户使用时（非业务高峰期）
- **预计停机时间**: 5-10分钟
- **总耗时**: 15-30分钟（含备份和验证）

## 执行前检查清单

- [ ] 确认E盘数据库包含最新数据
- [ ] 确认有足够的E盘空间用于备份（至少2GB）
- [ ] 确认没有应用正在使用MongoDB
- [ ] 准备好管理员权限PowerShell窗口
- [ ] 了解回滚步骤

## 相关文件位置

| 项目 | 当前位置 | 备注 |
|------|---------|------|
| MongoDB 程序 | `C:\Program Files\MongoDB\Server\8.0` | 程序保留在C盘 |
| 配置文件 | `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg` | 已正确配置 |
| **活动数据** | `E:\Program Files\MongoDB\Server\8.0\data` | ✅ 当前使用 |
| **旧数据** | `C:\data\db` | ⚠️ 待清理 |
| 日志文件 | `E:\Program Files\MongoDB\Server\8.0\log` | ✅ 正常 |

---

**报告生成时间**: 2025-10-27
**MongoDB版本**: 8.0
**当前状态**: 数据已在E盘，仅需清理C盘旧数据
