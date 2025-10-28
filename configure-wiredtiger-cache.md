# WiredTiger缓存配置指南

## 📋 配置步骤

### 第1步: 找到MongoDB配置文件

MongoDB配置文件通常位于:

**Windows**:
```
C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg
C:\Program Files\MongoDB\Server\6.0\bin\mongod.cfg
C:\Program Files\MongoDB\Server\5.0\bin\mongod.cfg
```

**如何查找**:
1. 打开任务管理器
2. 找到 `mongod.exe` 进程
3. 右键 → "打开文件所在位置"
4. 配置文件 `mongod.cfg` 通常在同一目录

---

### 第2步: 编辑配置文件

用管理员权限打开 `mongod.cfg` (使用记事本或VS Code)

找到 `storage:` 部分，修改为:

```yaml
storage:
  dbPath: C:\data\db
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # ← 添加这一行，限制缓存为4GB
```

**完整示例**:
```yaml
# mongod.conf

# Where and how to store data.
storage:
  dbPath: C:\data\db
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # 限制WiredTiger缓存为4GB

# Where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: C:\data\log\mongod.log

# Network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1
```

---

### 第3步: 重启MongoDB服务

**方法1: 使用命令行 (推荐)**

以管理员身份运行PowerShell或CMD:

```powershell
# 停止MongoDB服务
net stop MongoDB

# 等待几秒

# 启动MongoDB服务
net start MongoDB
```

**方法2: 使用服务管理器**

1. 按 Win + R
2. 输入 `services.msc`
3. 找到 "MongoDB" 服务
4. 右键 → "重新启动"

---

### 第4步: 验证配置

运行验证脚本:

```bash
node verify-wiredtiger-config.js
```

或者手动验证:

```bash
# 连接MongoDB
mongosh lottery

# 查看服务器状态
db.serverStatus().wiredTiger.cache

# 应该看到:
# "maximum bytes configured": 4294967296  (4GB = 4 * 1024 * 1024 * 1024)
```

---

## 📊 预期效果

| 指标 | 配置前 | 配置后 | 改善 |
|------|--------|--------|------|
| 最大缓存 | 15.8 GB | 4 GB | ⬇️ 75% |
| 实际占用 | 9.2 GB | 3-4 GB | ⬇️ 60% |
| 查询性能 | 良好 | 良好 | ✅ 保持 |

**重要**: 4GB缓存仍然足够维持良好的查询性能！

---

## ⚠️ 注意事项

1. **需要管理员权限**
   - 编辑配置文件需要管理员权限
   - 重启服务也需要管理员权限

2. **确保路径正确**
   - `cacheSizeGB` 必须正确缩进 (YAML格式严格)
   - 使用空格缩进，不要用Tab

3. **备份配置文件**
   - 修改前先备份原始的 `mongod.cfg`
   - 如果出错可以快速恢复

4. **验证服务启动**
   - 重启后检查MongoDB服务是否正常运行
   - 如果启动失败，检查配置文件格式

---

## 🔧 故障排除

### 问题1: 服务无法启动

**可能原因**: 配置文件格式错误

**解决方法**:
1. 恢复备份的配置文件
2. 重新编辑，注意YAML格式:
   - 使用2个空格缩进
   - 冒号后面要有空格
   - 不要使用Tab

### 问题2: 找不到mongod.cfg

**解决方法**:
1. 在任务管理器中找到 `mongod.exe` 的位置
2. 或者搜索整个C盘: `mongod.cfg`

### 问题3: 没有管理员权限

**解决方法**:
1. 右键命令提示符或PowerShell
2. 选择"以管理员身份运行"
3. 或者请系统管理员帮助

---

## ✅ 完成检查清单

- [ ] 找到了 mongod.cfg 文件
- [ ] 备份了原始配置文件
- [ ] 添加了 `cacheSizeGB: 4` 配置
- [ ] 成功重启了MongoDB服务
- [ ] 运行验证脚本确认配置生效
- [ ] MongoDB内存占用降至4-5GB

---

**配置完成后，继续执行其他优化步骤！**
