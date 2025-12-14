const { MongoClient } = require('mongodb');

async function checkAllModels() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 从代码中提取的所有HIT_DLT_开头的模型名
  const modelNames = [
    'HIT_DLT_ComboFeatures',
    'HIT_DLT_RedCombinationsHotWarmColdOptimized',
    'HIT_DLT_RedCombinationsHotWarmCold',
    'HIT_DLT_Basictrendchart_redballmissing_history',
    'HIT_DLT_Basictrendchart_blueballmissing_history',
    'HIT_DLT_RedCombination',
    'HIT_DLT_BlueCombination',
    'HIT_DLT_CombinationCache',
    'HIT_DLT_PeriodCombinationCache',
    'HIT_DLT_BaseCombination',
    'HIT_DLT_PeriodAnalysis',
    'HIT_DLT_PredictionTask',
    'HIT_DLT_PredictionTaskResult',
    'HIT_DLT_ExclusionDetails',
    'HIT_DLT_HwcPositivePredictionTask',
    'HIT_DLT_HwcPositivePredictionTaskResult',
    'HIT_DLT_Pattern',
    'HIT_DLT_PatternHistory',
    'HIT_DLT_PatternRecommendation'
  ];

  // 获取所有集合名
  const allCollections = await db.listCollections().toArray();
  const collectionNames = allCollections.map(c => c.name);

  console.log('=== 检查所有HIT_DLT_模型的集合对应关系 ===\n');

  for (const modelName of modelNames) {
    // Mongoose默认转换：小写+s
    const expectedCollectionDefault = modelName.toLowerCase() + 's';
    // 也可能直接使用原名
    const expectedCollectionOriginal = modelName;

    // 查找匹配的集合
    let matchedCollection = null;
    let matchedCount = 0;

    // 1. 先检查默认转换的集合名
    if (collectionNames.includes(expectedCollectionDefault)) {
      matchedCollection = expectedCollectionDefault;
      matchedCount = await db.collection(expectedCollectionDefault).countDocuments();
    }
    // 2. 检查原名
    else if (collectionNames.includes(expectedCollectionOriginal)) {
      matchedCollection = expectedCollectionOriginal;
      matchedCount = await db.collection(expectedCollectionOriginal).countDocuments();
    }
    // 3. 搜索类似名称的集合
    else {
      const keyword = modelName.toLowerCase().replace(/hit_dlt_/i, '').replace(/_/g, '').substring(0, 15);
      for (const name of collectionNames) {
        const nameNormalized = name.toLowerCase().replace(/_/g, '');
        if (nameNormalized.includes(keyword)) {
          const count = await db.collection(name).countDocuments();
          if (count > matchedCount) {
            matchedCollection = name;
            matchedCount = count;
          }
        }
      }
    }

    // 输出结果
    const status = matchedCount > 0 ? '✅' : '❌';
    console.log(`${status} 模型: ${modelName}`);
    console.log(`   期望集合: ${expectedCollectionDefault}`);
    if (matchedCollection) {
      console.log(`   实际集合: ${matchedCollection} (${matchedCount} records)`);
      if (matchedCollection !== expectedCollectionDefault && matchedCount > 0) {
        console.log(`   ⚠️ 警告: 集合名不匹配！需要在mongoose.model中指定第三个参数`);
      }
    } else {
      console.log(`   实际集合: 未找到`);
    }
    console.log('');
  }

  await client.close();
}

checkAllModels().catch(console.error);
