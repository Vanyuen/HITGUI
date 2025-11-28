# 热温冷优化表集合处理实施方案

## 目标
1. 清理冗余集合
2. 优化 `hit_dlt_redcombinationshotwarmcoldoptimizeds` 集合
3. 规范化数据存储和使用

## 实施步骤

### 1. 集合清理
```javascript
async function cleanupRedundantCollections() {
  const collectionsToRemove = [
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    'hit_dlt_redcombinationshotwarmcoldoptimized',
    'hit_dlt_hwcoptimized',
    // 其他类似但未使用的集合
  ];

  const db = mongoose.connection.db;

  for (const collectionName of collectionsToRemove) {
    try {
      // 先检查集合是否为空
      const collection = db.collection(collectionName);
      const documentCount = await collection.countDocuments();

      if (documentCount === 0) {
        // 如果集合为空，直接删除
        await collection.drop();
        console.log(`✅ 删除空集合: ${collectionName}`);
      } else {
        // 如果集合非空，记录日志并保留
        console.log(`⚠️ 集合 ${collectionName} 非空，需要人工审核`);
      }
    } catch (error) {
      console.error(`❌ 处理集合 ${collectionName} 时发生错误:`, error);
    }
  }
}
```

### 2. 集合数据优化
```javascript
async function optimizeHwcCollection() {
  const collection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

  // 1. 添加索引以提高查询性能
  await collection.createIndexes([
    { key: { base_issue: 1 }, name: 'base_issue_index' },
    { key: { target_issue: 1 }, name: 'target_issue_index' },
    { key: { is_predicted: 1 }, name: 'prediction_status_index' }
  ]);

  // 2. 补充热温冷比信息
  const updateOperation = {
    $set: {
      hot_ratio: calculateHotRatio(),
      warm_ratio: calculateWarmRatio(),
      cold_ratio: calculateColdRatio(),
      hwc_classification_version: '1.0'
    }
  };

  await collection.updateMany({}, updateOperation);

  // 3. 清理无效或过时数据
  await collection.deleteMany({
    base_issue: { $lt: getEarliestValidIssue() }
  });

  console.log('✨ 热温冷优化表数据优化完成');
}

function calculateHotRatio() {
  // 根据遗漏值计算热球比例的逻辑
  // TODO: 实现具体的热球比例计算算法
}

function calculateWarmRatio() {
  // 根据遗漏值计算温球比例的逻辑
  // TODO: 实现具体的温球比例计算算法
}

function calculateColdRatio() {
  // 根据遗漏值计算冷球比例的逻辑
  // TODO: 实现具体的冷球比例计算算法
}

function getEarliestValidIssue() {
  // 返回最早有效的期号
  // 通常是保留最近N年或M期的数据
  return '20000'; // 示例值
}
```

### 3. 使用规范化
```javascript
async function standardizeHwcCollectionUsage() {
  const predictionTasksCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');

  // 更新预测任务中的集合引用
  await predictionTasksCollection.updateMany(
    { optimized_collection: { $exists: false } },
    {
      $set: {
        optimized_collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
        collection_reference_version: '1.0'
      }
    }
  );

  // 验证集合引用的一致性
  const tasksUsingCollection = await predictionTasksCollection.countDocuments({
    optimized_collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds'
  });

  console.log(`🔍 使用标准化集合的任务数: ${tasksUsingCollection}`);
}
```

### 4. 主执行函数
```javascript
async function executeHwcCollectionOptimization() {
  try {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🚀 开始热温冷优化表集合处理');

    // 依次执行各个优化步骤
    await cleanupRedundantCollections();
    await optimizeHwcCollection();
    await standardizeHwcCollectionUsage();

    console.log('✅ 热温冷优化表集合处理完成');
  } catch (error) {
    console.error('❌ 集合处理过程中发生错误:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// 执行优化
executeHwcCollectionOptimization();
```

## 风险控制
1. 在生产环境执行前，先在测试环境验证
2. 备份重要数据
3. 分阶段实施
4. 准备回滚方案

## 预期效果
- 清理冗余集合
- 提高数据查询性能
- 统一集合命名和引用
- 为热温冷比计算提供标准化基础

## 后续跟踪
1. 监控集合性能
2. 验证热温冷比计算逻辑
3. 持续优化数据模型

---
**文档版本**：v1.0
**最后更新**：2025-11-24