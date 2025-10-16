require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// 设置mongoose选项以避免deprecation警告
mongoose.set('strictQuery', false);
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.mongod = null;
    this.isConnected = false;
    this.dbPath = null;
  }

  /**
   * 初始化数据库连接
   * @param {string} userDataPath - Electron用户数据路径
   */
  async initialize(userDataPath = null) {
    try {
      // 设置数据库存储路径
      if (userDataPath) {
        this.dbPath = path.join(userDataPath, 'database');
        if (!fs.existsSync(this.dbPath)) {
          fs.mkdirSync(this.dbPath, { recursive: true });
        }
      }

      // 尝试连接到本地MongoDB实例
      const localUri = 'mongodb://127.0.0.1:27017/lottery';

      try {
        await mongoose.connect(localUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000, // 5秒超时
          connectTimeoutMS: 30000,         // 连接超时30秒
          socketTimeoutMS: 45000,          // Socket超时45秒（性能优化：更快发现问题）
          maxPoolSize: 10,                 // 连接池大小
          minPoolSize: 2
        });

        console.log('✅ 已连接到本地MongoDB数据库');
        this.isConnected = true;
        return localUri;

      } catch (localError) {
        console.log('⚠️  本地MongoDB连接失败，启动内嵌数据库...');
        console.log('连接错误详情:', localError.message);

        // 启动内嵌MongoDB
        this.mongod = await MongoMemoryServer.create({
          instance: {
            dbName: 'lottery',
            storageEngine: 'wiredTiger'
          },
          binary: {
            version: '6.0.9',
            skipMD5: true
          },
          auth: {
            disable: true
          }
        });

        const uri = this.mongod.getUri();

        await mongoose.connect(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });

        console.log('✅ 内嵌MongoDB数据库已启动');
        console.log(`📁 数据库路径: ${this.dbPath || '内存存储'}`);
        this.isConnected = true;
        return uri;
      }

    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('📦 数据库连接已关闭');
      }

      if (this.mongod) {
        await this.mongod.stop();
        console.log('🔴 内嵌MongoDB已停止');
        this.mongod = null;
      }

      this.isConnected = false;
    } catch (error) {
      console.error('关闭数据库时出错:', error);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  /**
   * 备份数据库
   */
  async backup(backupPath) {
    if (!this.isConnected) {
      throw new Error('数据库未连接');
    }

    try {
      // 获取所有集合
      const collections = await mongoose.connection.db.listCollections().toArray();
      const backupData = {};

      for (const collection of collections) {
        const collectionName = collection.name;
        const documents = await mongoose.connection.db
          .collection(collectionName)
          .find({})
          .toArray();

        backupData[collectionName] = documents;
      }

      // 写入备份文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupPath, `lottery-backup-${timestamp}.json`);

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

      console.log(`✅ 数据库备份完成: ${backupFile}`);
      return backupFile;

    } catch (error) {
      console.error('数据库备份失败:', error);
      throw error;
    }
  }

  /**
   * 恢复数据库
   */
  async restore(backupFile) {
    if (!this.isConnected) {
      throw new Error('数据库未连接');
    }

    try {
      if (!fs.existsSync(backupFile)) {
        throw new Error('备份文件不存在');
      }

      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

      // 清空现有数据
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const collection of collections) {
        await mongoose.connection.db.collection(collection.name).deleteMany({});
      }

      // 恢复数据
      for (const [collectionName, documents] of Object.entries(backupData)) {
        if (documents && documents.length > 0) {
          await mongoose.connection.db
            .collection(collectionName)
            .insertMany(documents);
        }
      }

      console.log(`✅ 数据库恢复完成，从文件: ${backupFile}`);

    } catch (error) {
      console.error('数据库恢复失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      const collections = await db.listCollections().toArray();

      const collectionStats = {};
      for (const collection of collections) {
        const collectionStat = await db.collection(collection.name).stats();
        collectionStats[collection.name] = {
          count: collectionStat.count,
          size: collectionStat.size,
          avgObjSize: collectionStat.avgObjSize
        };
      }

      return {
        database: {
          name: stats.db,
          collections: stats.collections,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexes: stats.indexes,
          indexSize: stats.indexSize
        },
        collections: collectionStats
      };

    } catch (error) {
      console.error('获取数据库统计信息失败:', error);
      return null;
    }
  }
}

// 创建单例实例
const dbManager = new DatabaseManager();

module.exports = dbManager;