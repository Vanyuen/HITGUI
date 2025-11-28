/**
 * 检查所有蓝球组合相关集合的名称
 */

const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 检查所有集合 ===\n');

  const collections = await db.listCollections().toArray();
  const blueCollections = collections.filter(c =>
    c.name.toLowerCase().includes('blue')
  );

  console.log('包含"blue"的集合:');
  blueCollections.forEach(c => {
    console.log(`  - ${c.name}`);
  });

  console.log('\n所有大乐透相关集合:');
  const dltCollections = collections.filter(c =>
    c.name.toLowerCase().includes('dlt') || c.name.toLowerCase().includes('hit_')
  );
  dltCollections.forEach(c => {
    console.log(`  - ${c.name}`);
  });

  // 尝试不同的集合名称
  console.log('\n=== 尝试查询不同集合名称 ===\n');

  const namesToTry = [
    'hit_dlt_bluecombinations',
    'hit_dlts',
    'hit_dlt_BlueCombinations',
    'HIT_DLT_bluecombinations'
  ];

  for (const name of namesToTry) {
    try {
      const count = await db.collection(name).countDocuments();
      console.log(`${name}: ${count}条记录`);

      if (count > 0) {
        const sample = await db.collection(name).findOne({});
        console.log(`  样本字段: ${Object.keys(sample).join(', ')}`);
      }
    } catch (error) {
      console.log(`${name}: 查询失败`);
    }
  }

  await client.close();
})();
