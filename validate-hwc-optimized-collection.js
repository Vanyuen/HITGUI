const mongoose = require('mongoose');

async function validateHwcOptimizedCollection() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    console.log('🔍 热温冷优化表集合使用情况全面诊断');

    // 1. 基本信息检查
    const totalDocuments = await collection.countDocuments();
    console.log(`📊 总文档数: ${totalDocuments}`);

    // 2. 抽样文档检查
    const sampleDocuments = await collection.find().limit(5).toArray();
    console.log('🔬 抽样文档:');
    sampleDocuments.forEach((doc, index) => {
      console.log(`文档 ${index + 1}:`);
      console.log(JSON.stringify(doc, null, 2));
    });

    // 3. 检查数据完整性
    const aggregationPipeline = [
      {
        $group: {
          _id: null,
          avgHotRatio: { $avg: '$hotRatio' },
          avgWarmRatio: { $avg: '$warmRatio' },
          avgColdRatio: { $avg: '$coldRatio' }
        }
      }
    ];

    const ratioStats = await collection.aggregate(aggregationPipeline).toArray();
    console.log('📈 热温冷比统计:');
    console.log(JSON.stringify(ratioStats, null, 2));

    // 4. 检查在预测任务中的实际使用
    const predictionTaskCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');
    const tasksUsingCollection = await predictionTaskCollection.countDocuments({
      hwcOptimizedCollectionUsed: 'hit_dlt_redcombinationshotwarmcoldoptimizeds'
    });
    console.log(`🔗 使用该集合的预测任务数: ${tasksUsingCollection}`);

  } catch (error) {
    console.error('💥 诊断过程中发生错误:', error);
  } finally {
    await mongoose.connection.close();
  }
}

validateHwcOptimizedCollection();