require('dotenv').config();
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
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

// 开发模式检测
const isDev = process.argv.includes('--dev') || !app.isPackaged;

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
    // 加载应用
    mainWindow.loadURL('http://localhost:3003');
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
          label: '数据库管理',
          click: () => {
            mainWindow.webContents.send('menu-database-manage');
          }
        },
        {
          label: '清理缓存',
          click: () => {
            mainWindow.webContents.session.clearCache();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '缓存清理',
              message: '缓存已清理完成！'
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

      // 导入服务器代码
      const serverModule = require('./src/server/server.js');

      // 启动服务器
      expressServer = serverModule.listen(3003, 'localhost', async () => {
        console.log('✅ 内嵌服务器已启动: http://localhost:3003');
        console.log('📊 数据库连接状态:', dbManager.getConnectionStatus());

        // 性能优化：创建数据库索引
        if (serverModule.ensureDatabaseIndexes) {
          await serverModule.ensureDatabaseIndexes();
        }

        // ⚠️ 阶段2优化 B1：预加载组合特征缓存（已禁用，占用过多内存和CPU）
        // 这个预加载会在启动时加载324,632个组合到内存（727MB），导致MongoDB和CPU负载过高
        // 批量预测功能仍然会使用"阶段1优化"的按需缓存机制，已经提供6倍性能提升
        // if (serverModule.preloadComboFeaturesCache) {
        //   await serverModule.preloadComboFeaturesCache();
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

// 停止内嵌服务器
async function stopInternalServer() {
  try {
    if (expressServer) {
      expressServer.close(() => {
        console.log('🔴 内嵌服务器已停止');
      });
    }

    // 关闭数据库连接
    await dbManager.close();

  } catch (error) {
    console.error('停止服务器时出错:', error);
  }
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
  await stopInternalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopInternalServer();
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

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('应用程序错误', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});