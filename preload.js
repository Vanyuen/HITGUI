const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // 文件对话框
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // 菜单事件监听
  onMenuImportData: (callback) => ipcRenderer.on('menu-import-data', callback),
  onMenuExportData: (callback) => ipcRenderer.on('menu-export-data', callback),
  onMenuDatabaseManage: (callback) => ipcRenderer.on('menu-database-manage', callback),

  // 移除事件监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 数据库管理
  getDbStatus: () => ipcRenderer.invoke('get-db-status'),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),

  // 平台信息
  platform: process.platform,

  // 通知功能
  showNotification: (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }
});

// 暴露Node.js路径模块的部分功能
contextBridge.exposeInMainWorld('pathAPI', {
  join: (...args) => require('path').join(...args),
  dirname: (path) => require('path').dirname(path),
  basename: (path) => require('path').basename(path)
});

// 暴露一些有用的工具函数
contextBridge.exposeInMainWorld('utilsAPI', {
  // 格式化日期
  formatDate: (date, format = 'YYYY-MM-DD') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  // 生成UUID
  generateUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // 深拷贝
  deepClone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  // 数组去重
  uniqueArray: (arr) => {
    return [...new Set(arr)];
  },

  // 防抖函数
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});

// 日志功能
contextBridge.exposeInMainWorld('logAPI', {
  info: (message, ...args) => console.log(`[INFO] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[DEBUG] ${message}`, ...args)
});

console.log('Preload script loaded successfully');