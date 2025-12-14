const { MongoClient } = require('mongodb');

async function checkAllCollections() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 代码中定义的模型名（mongoose会转换）
  const modelDefinitions = [
    { model: 'DLTRedCombinationsHotWarmColdOptimized', mongooseModel: 'HIT_DLT_RedCombinationsHotWarmColdOptimized' },
    { model: 'DLTRedCombinationsHotWarmCold', mongooseModel: 'HIT_DLT_RedCombinationsHotWarmCold' },
    { model: 'HwcPositivePredictionTask', mongooseModel: 'HIT_DLT_HwcPositivePredictionTask' },
    { model: 'HwcPositivePredictionTaskResult', mongooseModel: 'HIT_DLT_HwcPositivePredictionTaskResult' },
  ];

  console.log('=== 检查所有HWC相关集合 ===\n');

  // 列出所有集合
  const allCollections = await db.listCollections().toArray();
  const collectionNames = allCollections.map(c => c.name);

  // 对每个模型检查可能的集合名
  for (const def of modelDefinitions) {
    console.log(`📦 模型: ${def.model}`);
    console.log(`   Mongoose模型名: ${def.mongooseModel}`);

    // Mongoose可能的集合名转换规则
    const possibleNames = [
      def.mongooseModel,  // 原名
      def.mongooseModel.toLowerCase(),  // 全小写
      def.mongooseModel.toLowerCase() + 's',  // 全小写+s
      def.mongooseModel + 's',  // 原名+s
    ];

    // 查找匹配的集合
    const matchedCollections = [];
    for (const name of collectionNames) {
      if (name.toLowerCase().includes(def.mongooseModel.toLowerCase().replace(/_/g, '').replace('hit_dlt_', '').substring(0, 15))) {
        const count = await db.collection(name).countDocuments();
        matchedCollections.push({ name, count });
      }
    }

    // 也搜索hwc或hotwarmcold关键词
    const keywords = ['hwcpositive', 'hotwarmcold'];
    for (const kw of keywords) {
      if (def.mongooseModel.toLowerCase().includes(kw.substring(0, 8))) {
        for (const name of collectionNames) {
          if (name.toLowerCase().includes(kw) && !matchedCollections.find(m => m.name === name)) {
            const count = await db.collection(name).countDocuments();
            matchedCollections.push({ name, count });
          }
        }
      }
    }

    console.log('   匹配的集合:');
    for (const m of matchedCollections) {
      const marker = m.count > 0 ? '✅' : '❌';
      console.log(`     ${marker} ${m.name}: ${m.count} records`);
    }
    console.log('');
  }

  // 专门检查有数据的HWC相关集合
  console.log('=== 有数据的HWC相关集合 ===\n');
  for (const name of collectionNames) {
    if (name.toLowerCase().includes('hwc') || name.toLowerCase().includes('hotwarmcold')) {
      const count = await db.collection(name).countDocuments();
      if (count > 0) {
        console.log(`✅ ${name}: ${count} records`);
      }
    }
  }

  await client.close();
}

checkAllCollections().catch(console.error);
