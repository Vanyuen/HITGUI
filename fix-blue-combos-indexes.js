/**
 * 修复蓝球组合集合的索引问题
 */

const { MongoClient } = require('mongodb');

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  console.log('=== 修复蓝球组合索引 ===\n');

  const targetCollection = db.collection('hit_dlt_bluecombinations');

  // 1. 查看现有索引
  console.log('现有索引:');
  const indexes = await targetCollection.indexes();
  indexes.forEach(idx => {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`);
  });

  // 2. 删除错误的 id_1 索引
  console.log('\n删除错误的索引...');
  try {
    await targetCollection.dropIndex('id_1');
    console.log('✅ 已删除 id_1 索引');
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('  索引不存在，跳过');
    } else {
      console.log(`  错误: ${error.message}`);
    }
  }

  // 3. 清空集合
  console.log('\n清空集合...');
  await targetCollection.deleteMany({});
  console.log('✅ 已清空');

  // 4. 从源集合读取数据
  const sourceCollection = db.collection('hit_dlts');
  const allData = await sourceCollection.find({}).toArray();
  console.log(`\n读取源数据: ${allData.length}条`);

  // 5. 插入数据（只保留必要字段）
  console.log('\n插入数据...');
  const cleanedData = allData.map(doc => ({
    _id: doc._id,
    combination_id: doc.combination_id,
    blue_ball_1: doc.blue_ball_1,
    blue_ball_2: doc.blue_ball_2,
    sum_value: doc.sum_value,
    created_at: doc.created_at || new Date()
  }));

  const result = await targetCollection.insertMany(cleanedData);
  console.log(`✅ 插入成功: ${result.insertedCount}条`);

  // 6. 创建正确的索引
  console.log('\n创建索引...');
  await targetCollection.createIndex({ combination_id: 1 }, { unique: true });
  console.log('✅ 创建 combination_id 唯一索引');

  await targetCollection.createIndex({ sum_value: 1 });
  console.log('✅ 创建 sum_value 索引');

  // 7. 验证
  const finalCount = await targetCollection.countDocuments();
  console.log(`\n验证: 目标集合现有 ${finalCount}条记录`);

  const samples = await targetCollection.find({}).limit(5).toArray();
  console.log('\n样本数据:');
  samples.forEach(s => {
    console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}]`);
  });

  const lastSamples = await targetCollection.find({}).sort({ combination_id: -1 }).limit(3).toArray();
  console.log('\n最后3条:');
  lastSamples.reverse().forEach(s => {
    console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}]`);
  });

  console.log('\n✅ 修复完成！');

  await client.close();
})();
