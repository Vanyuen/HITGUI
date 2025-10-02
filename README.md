# HITGUI - HIT数据分析系统桌面版

HIT双色球和大乐透数据分析系统的Electron桌面客户端版本。

## 功能特性

### 🎯 核心功能
- **双色球分析**: 历史数据查询、趋势图表、缺失值统计、预测推荐
- **大乐透分析**: 完整的大乐透数据分析功能，包括红球蓝球分析
- **图表可视化**: 基于Chart.js的专业数据图表展示
- **Excel导出**: 同出数据分析、预测结果导出功能
- **离线运行**: 支持完全离线使用，内嵌数据库

### 🔧 技术特性
- **跨平台**: 支持Windows、macOS、Linux
- **内嵌数据库**: MongoDB Memory Server，支持数据持久化
- **安全隔离**: Context Isolation安全架构
- **数据管理**: 数据库备份、恢复、统计功能
- **自动更新**: 支持应用程序自动更新

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖
```bash
cd E:\HITGUI
npm install
```

### 开发模式
```bash
npm run dev
```

### 生产模式
```bash
npm start
```

### 打包发布
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 所有平台
npm run build
```

## 项目结构

```
E:\HITGUI/
├── main.js                 # Electron主进程
├── preload.js              # 预加载脚本
├── package.json            # 项目配置
├── src/
│   ├── renderer/           # 前端代码 (Web界面)
│   │   ├── index.html      # 主界面
│   │   ├── app.js          # 双色球功能
│   │   ├── dlt-module.js   # 大乐透功能
│   │   └── *.css           # 样式文件
│   ├── server/             # 后端代码 (API服务)
│   │   ├── server.js       # Express服务器
│   │   └── .env           # 环境配置
│   └── database/           # 数据库管理
│       └── config.js       # 数据库配置
├── build/                  # 构建资源
└── dist/                   # 打包输出
```

## 主要命令

| 命令 | 功能 |
|------|------|
| `npm start` | 启动应用程序 |
| `npm run dev` | 开发模式(含调试工具) |
| `npm run build` | 构建所有平台安装包 |
| `npm run pack` | 仅打包不制作安装程序 |

## 数据库管理

### 数据存储
- **本地MongoDB**: 优先连接本地MongoDB实例
- **内嵌数据库**: 自动fallback到内嵌MongoDB Memory Server
- **数据持久化**: 数据存储在用户数据目录

### 数据管理功能
- **备份**: 导出完整数据库为JSON格式
- **恢复**: 从备份文件恢复数据
- **统计**: 查看数据库使用统计信息
- **清理**: 清理缓存和临时数据

## 应用菜单

### 文件菜单
- **导入数据** (Ctrl+I): 导入历史开奖数据
- **导出数据** (Ctrl+E): 导出分析结果
- **退出** (Ctrl+Q): 退出应用程序

### 工具菜单
- **数据库管理**: 数据库备份、恢复、统计
- **清理缓存**: 清理应用程序缓存
- **开发者工具** (Ctrl+Shift+I): 打开调试工具

### 帮助菜单
- **关于**: 显示应用程序信息

## API接口

应用程序内部运行Express服务器(端口3001)，提供完整的REST API：

### 双色球API
- `GET /api/ssq/history` - 获取历史数据
- `GET /api/trendchart` - 获取趋势图数据
- `POST /api/cooccurrence-excel` - 生成同出数据Excel

### 大乐透API
- `GET /api/dlt/history` - 获取历史数据
- `GET /api/dlt/trendchart` - 获取趋势图数据
- `GET /api/dlt/combinations` - 获取组合预测数据

## 安全特性

- **Context Isolation**: 渲染进程和主进程完全隔离
- **No Node Integration**: 渲染进程无法直接访问Node.js
- **Preload Scripts**: 通过预加载脚本提供安全API
- **CSP Header**: 设置内容安全策略

## 故障排除

### 常见问题

1. **端口占用**
   ```
   错误: Error: listen EADDRINUSE: address already in use :::3001
   解决: 关闭占用3001端口的程序或修改配置
   ```

2. **数据库连接失败**
   ```
   自动启用内嵌数据库，数据存储在用户目录
   ```

3. **权限问题**
   ```
   以管理员身份运行或检查文件权限
   ```

### 调试模式
```bash
npm run dev
```
开启调试模式后可以：
- 查看控制台日志
- 使用开发者工具
- 实时编辑前端代码

## 更新日志

### v1.0.0
- ✅ 完整迁移Web版本所有功能
- ✅ 内嵌MongoDB数据库支持
- ✅ 数据库管理功能
- ✅ 跨平台打包支持
- ✅ 安全架构实现

## 技术支持

如有问题请查看：
1. 控制台错误日志
2. 数据库连接状态
3. 网络连接是否正常
4. 文件权限设置

## 开发者

HIT数据分析系统开发团队