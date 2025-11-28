const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 查找所有热温冷优化表相关的集合...\n');

  const collections = await db.listCollections().toArray();
  const hwcCollections = collections.filter(c =>
    c.name.toLowerCase().includes('hotwarmcold') ||
    c.name.toLowerCase().includes('hwc') ||
    c.name.toLowerCase().includes('optimized')
  );

  console.log('找到的热温冷相关集合:\n');
  hwcCollections.forEach(c => {
    console.log(`  - ${c.name}`);
  });

  console.log('\n📊 检查每个集合的数据量和最新记录...\n');

  for (const coll of hwcCollections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`【${coll.name}】`);
    console.log(`  总记录数: ${count.toLocaleString()}`);

    if (count > 0) {
      // 检查最新的5条记录
      const latest = await db.collection(coll.name)
        .find({})
        .sort({ target_issue: -1 })
        .limit(5)
        .toArray();

      if (latest.length > 0) {
        console.log(`  最新期号对:`);
        latest.forEach(r => {
          const hwcDataKeys = r.hot_warm_cold_data ? Object.keys(r.hot_warm_cold_data).length : 0;
          console.log(`    ${r.base_issue} → ${r.target_issue}: ${hwcDataKeys}种比例, is_predicted=${r.is_predicted}`);
        });
      }

      // 特别检查是否有 25124→25125
      const has25124to25125 = await db.collection(coll.name)
        .findOne({ base_issue: 25124, target_issue: 25125 });

      if (has25124to25125) {
        console.log(`  ✅ 包含 25124→25125 数据`);
      } else {
        console.log(`  ❌ 不包含 25124→25125 数据`);
      }
    }

    console.log('');
  }

  await mongoose.connection.close();
}).catch(console.error);
