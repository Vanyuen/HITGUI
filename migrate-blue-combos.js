/**
 * 将蓝球组合从 HIT_DLT_BlueCombinations 迁移到 hit_dlt_bluecombinations
 */

const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 迁移蓝球组合数据 ===\n');

  // 源集合（大写）
  const sourceCollection = db.collection('HIT_DLT_BlueCombinations');
  const sourceCount = await sourceCollection.countDocuments();
  console.log(`源集合 (HIT_DLT_BlueCombinations): ${sourceCount}条记录`);

  // 目标集合（小写）
  const targetCollection = db.collection('hit_dlt_bluecombinations');
  const targetCountBefore = await targetCollection.countDocuments();
  console.log(`目标集合 (hit_dlt_bluecombinations): ${targetCountBefore}条记录`);

  if (sourceCount === 0) {
    console.log('❌ 源集合为空，无法迁移');
    await client.close();
    return;
  }

  // 读取所有数据
  const allData = await sourceCollection.find({}).toArray();
  console.log(`\n读取源数据: ${allData.length}条`);

  // 清空目标集合
  console.log('\n清空目标集合...');
  await targetCollection.deleteMany({});
  console.log('✅ 已清空');

  // 插入数据（移除 Mongoose 的 __v 字段）
  console.log('\n插入数据到目标集合...');
  const cleanedData = allData.map(doc => {
    const { __v, ...rest } = doc;
    return rest;
  });

  const result = await targetCollection.insertMany(cleanedData);
  console.log(`✅ 插入成功: ${result.insertedCount}条`);

  // 验证
  const targetCountAfter = await targetCollection.countDocuments();
  console.log(`\n验证: 目标集合现有 ${targetCountAfter}条记录`);

  // 显示样本
  const samples = await targetCollection.find({}).limit(5).toArray();
  console.log('\n目标集合样本:');
  samples.forEach(s => {
    console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}], 和值=${s.sum_value}`);
  });

  // 检查最后几条
  const lastSamples = await targetCollection.find({}).sort({ combination_id: -1 }).limit(3).toArray();
  console.log('\n目标集合最后3条:');
  lastSamples.reverse().forEach(s => {
    console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}], 和值=${s.sum_value}`);
  });

  console.log('\n✅ 迁移完成！');
  console.log(`   源集合 (HIT_DLT_BlueCombinations): ${sourceCount}条`);
  console.log(`   目标集合 (hit_dlt_bluecombinations): ${targetCountAfter}条`);

  await client.close();
})();
