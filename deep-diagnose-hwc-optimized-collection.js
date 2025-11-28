const mongoose = require('mongoose');

async function deepDiagnoseHwcOptimizedCollection() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const hwcTasksCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');
    const hwcTaskResultsCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults');

    console.log('🔍 热温冷优化表深度诊断');

    // 1. 文档结构分析
    const sampleDocument = await collection.findOne();
    console.log('📋 文档结构示例:');
    console.log(Object.keys(sampleDocument || {}));

    // 2. 期号范围分析
    const issueRangeAggregation = [
      { $group: {
        _id: null,
        minIssue: { $min: '$base_issue' },
        maxIssue: { $max: '$target_issue' },
        distinctIssuesCount: { $addToSet: '$base_issue' }
      }}
    ];
    const issueRangeStats = await collection.aggregate(issueRangeAggregation).toArray();
    console.log('🔢 期号范围统计:');
    console.log(JSON.stringify(issueRangeStats, null, 2));

    // 3. 关联任务分析
    const hwcTasksCount = await hwcTasksCollection.countDocuments();
    const hwcTaskResultsCount = await hwcTaskResultsCollection.countDocuments();
    console.log(`🔗 热温冷预测任务数: ${hwcTasksCount}`);
    console.log(`📊 热温冷预测任务结果数: ${hwcTaskResultsCount}`);

    // 4. 预测状态分析
    const predictionStatusAggregation = [
      { $group: {
        _id: '$is_predicted',
        count: { $sum: 1 }
      }}
    ];
    const predictionStatusStats = await collection.aggregate(predictionStatusAggregation).toArray();
    console.log('✨ 预测状态统计:');
    console.log(JSON.stringify(predictionStatusStats, null, 2));

    // 5. 交叉验证关联任务
    const tasksUsingCollection = await hwcTasksCollection.countDocuments({
      $or: [
        { optimized_collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' },
        { hwc_optimized_table: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' }
      ]
    });
    console.log(`🔍 引用该集合的任务数: ${tasksUsingCollection}`);

  } catch (error) {
    console.error('💥 诊断过程中发生错误:', error);
  } finally {
    await mongoose.connection.close();
  }
}

deepDiagnoseHwcOptimizedCollection();