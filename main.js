require('dotenv').config();
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');

// ⭐ 2025-11-14修复: 增加Node.js堆内存限制到16GB，防止处理大量期号时内存溢出
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=16384');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const Store = require('electron-store');
const dbManager = require('./src/database/config');

// 创建配置存储
const store = new Store();

let mainWindow;
let serverProcess;
let expressApp;
let expressServer;
let isQuitting = false;  // 标记应用是否正在退出
let activeConnections = new Set();  // 跟踪活跃连接

// 开发模式检测
const isDev = process.argv.includes('--dev') || !app.isPackaged;

// 🔒 单实例锁：防止多个应用实例同时运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('⚠️  应用已在运行，退出当前实例');
  app.quit();
  process.exit(0);
} else {
  // 当第二个实例尝试启动时，聚焦到第一个实例
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('🔔 检测到第二个实例启动，聚焦到当前窗口');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // 允许本地文件访问，生产环境需要更严格的安全策略
    },
    icon: path.join(__dirname, 'build/icon.png'),
    titleBarStyle: 'default',
    show: false // 先不显示，等窗口准备好再显示
  });

  // 设置窗口标题
  mainWindow.setTitle('HIT数据分析系统 v1.0');

  // 创建菜单
  createMenu();

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 启动内嵌服务器
  startInternalServer().then(() => {
    // 彻底清除所有缓存（包括JavaScript文件缓存）
    mainWindow.webContents.session.clearStorageData({
      storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
    }).then(() => {
      return mainWindow.webContents.session.clearCache();
    }).then(() => {
      console.log('🧹 Electron所有缓存已彻底清除');
      // 加载应用
      mainWindow.loadURL('http://localhost:3003');
    });
  }).catch(err => {
    console.error('Failed to start internal server:', err);
    dialog.showErrorBox('启动失败', '无法启动内部服务器，请检查端口是否被占用。');
    app.quit();
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopInternalServer();
  });

  // 阻止新窗口打开，在默认浏览器中打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入数据',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            // 发送消息到渲染进程
            mainWindow.webContents.send('menu-import-data');
          }
        },
        {
          label: '导出数据',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-export-data');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '工具',
      submenu: [
        {
          label: '数据管理后台',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            openAdminWindow();
          }
        },
        { type: 'separator' },
        {
          label: '数据库管理',
          click: () => {
            mainWindow.webContents.send('menu-database-manage');
          }
        },
        {
          label: '清理缓存',
          click: () => {
            mainWindow.webContents.session.clearStorageData({
              storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
            }).then(() => {
              return mainWindow.webContents.session.clearCache();
            }).then(() => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '缓存清理',
                message: '所有缓存已彻底清理完成！'
              });
            });
          }
        },
        {
          label: '重新加载页面',
          accelerator: 'CmdOrCtrl+F5',
          click: () => {
            mainWindow.webContents.reload();
          }
        },
        {
          label: '强制重新加载',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache();
          }
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 HIT数据分析系统',
              message: 'HIT数据分析系统',
              detail: '版本: 1.0.0\\n专业的双色球和大乐透数据分析工具\\n\\n© 2024 HIT数据分析系统'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 启动内嵌Express服务器
async function startInternalServer() {
  return new Promise(async (resolve, reject) => {
    try {
      // 首先初始化数据库
      await dbManager.initialize(app.getPath('userData'));

      // 🔥 清除server.js的require缓存（始终执行，确保加载最新代码）
      const serverPath = path.resolve(__dirname, 'src/server/server.js');
      if (require.cache[serverPath]) {
        console.log('🧹 清除server.js的require缓存...');
        delete require.cache[serverPath];
      } else {
        console.log('ℹ️  server.js首次加载，无需清除缓存');
      }

      // 导入服务器代码
      const serverModule = require('./src/server/server.js');

      // ⭐ 2025-11-15: 使用httpServer代替app以支持Socket.IO
      // 启动服务器
      expressServer = serverModule.httpServer.listen(3003, 'localhost', () => {
        console.log('✅ 内嵌服务器已启动: http://localhost:3003');
        console.log('🔌 Socket.IO服务器已启动，支持实时进度推送');
        console.log('📊 数据库连接状态:', dbManager.getConnectionStatus());

        // 跟踪活跃连接，便于优雅关闭
        expressServer.on('connection', (socket) => {
          activeConnections.add(socket);
          socket.on('close', () => {
            activeConnections.delete(socket);
          });
        });

        // 性能优化：在后台异步创建数据库索引（不阻塞窗口显示）
        if (serverModule.ensureDatabaseIndexes) {
          serverModule.ensureDatabaseIndexes().catch(err => {
            console.error('⚠️  索引创建失败（不影响正常使用）:', err.message);
          });
        }

        // ⚠️ 阶段2优化 B1：预加载组合特征缓存（已禁用，占用过多内存和CPU）
        // 这个预加载会在启动时加载324,632个组合到内存（727MB），导致MongoDB和CPU负载过高
        // 批量预测功能仍然会使用"阶段1优化"的按需缓存机制，已经提供6倍性能提升
        // if (serverModule.preloadComboFeaturesCache) {
        //   serverModule.preloadComboFeaturesCache().catch(err => {
        //     console.error('⚠️  缓存预加载失败（不影响正常使用）:', err.message);
        //   });
        // }

        resolve();
      });

      expressServer.on('error', (err) => {
        console.error('Server error:', err);
        reject(err);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      reject(error);
    }
  });
}

// 停止内嵌服务器（优雅关闭，带超时）
async function stopInternalServer() {
  if (isQuitting) {
    return; // 防止重复调用
  }
  isQuitting = true;

  return new Promise(async (resolve) => {
    console.log('🛑 开始关闭服务器...');

    // 设置3秒超时，防止hang住
    const forceShutdownTimeout = setTimeout(() => {
      console.log('⚠️  服务器关闭超时，强制终止所有连接');

      // 强制销毁所有活跃连接
      activeConnections.forEach(socket => {
        try {
          socket.destroy();
        } catch (e) {
          // 忽略错误
        }
      });
      activeConnections.clear();

      resolve();
    }, 3000);

    try {
      // 第1步：停止接受新连接
      if (expressServer) {
        expressServer.close(async () => {
          console.log('✅ 服务器已停止接受新连接');
          clearTimeout(forceShutdownTimeout);

          // 第2步：关闭数据库
          try {
            await dbManager.close();
            console.log('✅ 数据库连接已关闭');
          } catch (dbErr) {
            console.error('⚠️  关闭数据库时出错:', dbErr.message);
          }

          resolve();
        });

        // 等待一小段时间让现有请求完成
        setTimeout(() => {
          // 优雅关闭所有连接
          console.log(`📊 关闭 ${activeConnections.size} 个活跃连接...`);
          activeConnections.forEach(socket => {
            try {
              socket.end();  // 优雅关闭
            } catch (e) {
              socket.destroy();  // 如果优雅关闭失败，强制销毁
            }
          });
        }, 500);
      } else {
        // 没有服务器在运行
        clearTimeout(forceShutdownTimeout);
        await dbManager.close();
        resolve();
      }
    } catch (error) {
      clearTimeout(forceShutdownTimeout);
      console.error('❌ 停止服务器时出错:', error.message);
      resolve(); // 即使出错也要resolve，避免hang住
    }
  });
}

// 应用事件处理
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  console.log('📌 所有窗口已关闭');
  await stopInternalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 使用 will-quit 而不是 before-quit，并阻止默认行为直到清理完成
app.on('will-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();  // 阻止立即退出
    console.log('📌 应用即将退出，执行清理...');
    await stopInternalServer();
    app.quit();  // 清理完成后再退出
  }
});

// IPC 事件处理
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 数据库相关IPC处理
ipcMain.handle('get-db-status', () => {
  return dbManager.getConnectionStatus();
});

ipcMain.handle('get-db-stats', async () => {
  return await dbManager.getStats();
});

ipcMain.handle('backup-database', async () => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '保存数据库备份',
    defaultPath: `lottery-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [
      { name: 'JSON文件', extensions: ['json'] }
    ]
  });

  if (filePath) {
    try {
      const backupPath = path.dirname(filePath);
      await dbManager.backup(backupPath);
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: '用户取消操作' };
});

ipcMain.handle('restore-database', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '选择数据库备份文件',
    filters: [
      { name: 'JSON文件', extensions: ['json'] }
    ],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    try {
      await dbManager.restore(filePaths[0]);
      return { success: true, message: '数据库恢复成功' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: '用户取消操作' };
});

// IPC handler for opening pattern analysis window
ipcMain.handle('open-pattern-analysis', () => {
  const patternWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    icon: path.join(__dirname, 'build/icon.png'),
    title: 'HIT大乐透 - 规律分析系统'
  });

  patternWindow.loadURL('http://localhost:3003/pattern-analysis.html');

  if (isDev) {
    patternWindow.webContents.openDevTools();
  }

  return { success: true };
});

// Open admin window function
function openAdminWindow() {
  const adminWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    icon: path.join(__dirname, 'build/icon.png'),
    title: '大乐透数据管理后台'
  });

  adminWindow.loadURL('http://localhost:3003/admin.html');

  if (isDev) {
    adminWindow.webContents.openDevTools();
  }
}

// IPC handler for opening admin window (can also be called from renderer)
ipcMain.handle('open-admin-window', () => {
  openAdminWindow();
  return { success: true };
});

// 处理进程信号（Ctrl+C、强制终止等）
process.on('SIGINT', async () => {
  console.log('\n📌 收到 SIGINT 信号 (Ctrl+C)，执行清理...');
  await stopInternalServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📌 收到 SIGTERM 信号，执行清理...');
  await stopInternalServer();
  process.exit(0);
});

// Windows特定信号
if (process.platform === 'win32') {
  process.on('SIGBREAK', async () => {
    console.log('\n📌 收到 SIGBREAK 信号，执行清理...');
    await stopInternalServer();
    process.exit(0);
  });
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // 不要在这里调用 dialog，可能会导致问题
  // 记录错误并优雅退出
  stopInternalServer().then(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // 警告但不退出，继续运行
});