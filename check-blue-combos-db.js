const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 检查蓝球组合数据库 ===\n');

  const count = await db.collection('hit_dlt_bluecombinations').countDocuments();
  console.log('蓝球组合总数:', count);

  const blueCombos = await db.collection('hit_dlt_bluecombinations')
    .find({})
    .sort({ combination_id: 1 })
    .limit(10)
    .toArray();

  console.log('\n前10个蓝球组合:');
  blueCombos.forEach(bc => {
    console.log(`  ID=${bc.combination_id}: [${bc.blue_ball_1}, ${bc.blue_ball_2}]`);
  });

  await client.close();
})();
