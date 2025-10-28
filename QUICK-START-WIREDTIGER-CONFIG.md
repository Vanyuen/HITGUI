# WiredTiger缓存配置 - 快速指南

## 🎯 目标

将MongoDB的WiredTiger缓存从15.8GB限制为4GB，释放约5-6GB内存。

---

## 📋 简单3步配置

### 第1步: 打开配置文件

**文件路径**:
```
C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg
```

**如何打开**:
1. 以**管理员身份**打开记事本或VS Code
2. 文件 → 打开 → 粘贴上面的路径

---

### 第2步: 添加配置

在文件中找到 `storage:` 部分，添加以下内容:

**如果文件中已有这些配置**:
```yaml
storage:
  dbPath: C:\data\db
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # ← 添加这一行
```

**如果文件中没有wiredTiger配置**:
```yaml
storage:
  dbPath: C:\data\db
  wiredTiger:           # ← 添加整个wiredTiger部分
    engineConfig:
      cacheSizeGB: 4
```

**⚠️ 重要注意事项**:
- 使用**空格缩进**，不要用Tab键
- 冒号后面**必须有空格**
- 缩进**必须对齐** (2个空格一级)

**完整示例**:
```yaml
# mongod.conf

# 数据存储
storage:
  dbPath: C:\data\db
  journal:
    enabled: true
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4

# 日志
systemLog:
  destination: file
  logAppend: true
  path: C:\data\log\mongod.log

# 网络
net:
  port: 27017
  bindIp: 127.0.0.1
```

---

### 第3步: 重启MongoDB服务

**方法1: 使用命令行 (推荐)**

以**管理员身份**打开PowerShell或CMD，执行:

```powershell
# 停止MongoDB服务
net stop MongoDB

# 等待几秒

# 启动MongoDB服务
net start MongoDB
```

**方法2: 使用服务管理器**

1. 按 `Win + R`
2. 输入 `services.msc`，回车
3. 找到 "MongoDB" 服务
4. 右键 → "重新启动"

---

## ✅ 验证配置

配置完成后，运行:

```bash
node diagnose-mongodb-usage.js
```

检查输出中的:
```
💾 内存使用:
  WiredTiger缓存: XXX MB
  WiredTiger最大缓存: 4096.00 MB  ← 应该是4096MB (4GB)
```

---

## 📊 预期效果

| 指标 | 配置前 | 配置后 |
|------|--------|--------|
| MongoDB内存 | 9.2GB | 3-4GB |
| 系统可用内存 | 少 | 多5-6GB |
| 批量预测性能 | 快 | 几乎相同 (<5%影响) |

---

## ❓ 常见问题

### Q1: MongoDB服务无法启动怎么办？

**原因**: 配置文件格式错误

**解决**:
1. 检查缩进是否使用空格 (不要用Tab)
2. 检查冒号后面是否有空格
3. 恢复备份 (如果有)
4. 查看错误日志: `C:\data\log\mongod.log`

---

### Q2: 找不到mongod.cfg文件？

**解决**:
1. 打开任务管理器
2. 找到 `mongod.exe` 进程
3. 右键 → "打开文件所在位置"
4. mongod.cfg应该在同一目录

---

### Q3: 没有管理员权限怎么办？

**解决**:
1. 右键记事本/PowerShell
2. 选择"以管理员身份运行"
3. 或者请系统管理员帮助

---

### Q4: 配置后会影响批量预测性能吗？

**答案**: 几乎不会！

- 批量预测100期只需约500MB缓存
- 4GB缓存足够容纳所有热数据
- 性能影响<5%，几乎感觉不到

详细分析见: `wiredtiger-cache-impact-analysis.md`

---

## 🚀 完整操作清单

- [ ] 以管理员身份打开 `mongod.cfg`
- [ ] 添加 `cacheSizeGB: 4` 配置
- [ ] 检查格式 (空格缩进、冒号后有空格)
- [ ] 保存文件
- [ ] 重启MongoDB服务
- [ ] 运行 `node diagnose-mongodb-usage.js` 验证
- [ ] 运行 `npm start` 测试应用

---

## 📝 配置模板 (复制使用)

如果你的配置文件很简单，可以直接复制以下模板:

```yaml
storage:
  dbPath: C:\data\db
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4

systemLog:
  destination: file
  logAppend: true
  path: C:\data\log\mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1
```

---

**配置完成后，你的MongoDB内存占用将从9.2GB降至约3-4GB！** 🎉
