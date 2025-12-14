const { MongoClient } = require('mongodb');

async function diagnose() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 列出所有包含hwc或hot的集合
  console.log('=== 所有HWC相关集合 ===');
  const collections = await db.listCollections().toArray();
  const hwcCollections = collections.filter(c =>
    c.name.toLowerCase().includes('hwc') ||
    c.name.toLowerCase().includes('hotwarmcold') ||
    c.name.toLowerCase().includes('hot')
  );

  for (const coll of hwcCollections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`${coll.name}: ${count} records`);
  }

  // 2. 找到有2810条记录的集合
  console.log('\n=== 查找有2810条记录的集合 ===');
  for (const coll of hwcCollections) {
    const count = await db.collection(coll.name).countDocuments();
    if (count === 2810 || count > 2800) {
      console.log(`✅ ${coll.name}: ${count} records`);

      // 查看数据结构
      const sample = await db.collection(coll.name).findOne({}, { sort: { _id: -1 } });
      console.log('  最新记录的键:', Object.keys(sample || {}));
      console.log('  base_issue:', sample?.base_issue);
      console.log('  target_issue:', sample?.target_issue);

      // 检查25140和25141的数据
      for (const target of ['25140', '25141', '25142']) {
        const record = await db.collection(coll.name).findOne({ target_issue: target });
        if (record) {
          const hwcData = record.hot_warm_cold_data || {};
          const ratio311 = hwcData['3:1:1'] || [];
          console.log(`  target_issue ${target}: base=${record.base_issue}, 3:1:1组合数=${ratio311.length}`);
        } else {
          console.log(`  target_issue ${target}: ❌ 无数据`);
        }
      }
    }
  }

  await client.close();
}

diagnose().catch(console.error);
