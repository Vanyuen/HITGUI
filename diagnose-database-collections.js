const mongoose = require('mongoose');

async function diagnoseDatabaseCollections() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('🔍 数据库中的集合:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // 检查特定集合的文档数量
    const checkCollections = [
      'PredictionTask',
      'hit_dlts',
      'hit_dlt_redcombinations',
      'hit_dlt_bluecombinations',
      'HIT_DLT_RedCombinationsHotWarmColdOptimizeds'
    ];

    for (const collectionName of checkCollections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`📊 ${collectionName} 集合文档数量: ${count}`);
      } catch (err) {
        console.error(`❌ 查询 ${collectionName} 集合时发生错误:`, err.message);
      }
    }
  } catch (error) {
    console.error('💥 诊断过程中发生错误:', error);
  }
}

// 主执行函数
(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 数据库连接成功');

    await diagnoseDatabaseCollections();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  } finally {
    await mongoose.connection.close();
  }
})();