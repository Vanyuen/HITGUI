const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  console.log('\n🔍 详细检查 hit_dlt_redcombinationshotwarmcoldoptimizeds 表数据...\n');

  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  const totalCount = await db.collection(collection).countDocuments();
  console.log(`总记录数: ${totalCount.toLocaleString()}\n`);

  // 检查最新的10条记录
  console.log('最新10条记录:');
  const latest10 = await db.collection(collection)
    .find({})
    .sort({ target_issue: -1 })
    .limit(10)
    .toArray();

  latest10.forEach(r => {
    const hwcDataKeys = r.hot_warm_cold_data ? Object.keys(r.hot_warm_cold_data).length : 0;
    console.log(`  ${r.base_issue} → ${r.target_issue}: is_predicted=${r.is_predicted}, ${hwcDataKeys}种比例`);
  });

  // 检查 is_predicted 字段的分布
  console.log('\n📊 is_predicted 字段分布:');
  const drawnCount = await db.collection(collection).countDocuments({ is_predicted: false });
  const predictedCount = await db.collection(collection).countDocuments({ is_predicted: true });
  const nullCount = await db.collection(collection).countDocuments({ is_predicted: null });
  const undefinedCount = await db.collection(collection).countDocuments({ is_predicted: { $exists: false } });

  console.log(`  已开奖期 (is_predicted=false): ${drawnCount.toLocaleString()}`);
  console.log(`  推算期 (is_predicted=true): ${predictedCount.toLocaleString()}`);
  console.log(`  is_predicted=null: ${nullCount.toLocaleString()}`);
  console.log(`  is_predicted 不存在: ${undefinedCount.toLocaleString()}`);

  // 检查最新的已开奖期记录
  console.log('\n📊 最新的已开奖期记录:');
  const latestDrawn = await db.collection(collection)
    .find({ is_predicted: false })
    .sort({ target_issue: -1 })
    .limit(5)
    .toArray();

  latestDrawn.forEach(r => {
    console.log(`  ${r.base_issue} → ${r.target_issue}`);
  });

  // 检查是否有 25124→25125
  console.log('\n🔍 检查特定期号对:');
  const pairs = [
    { base: 25114, target: 25115 },
    { base: 25120, target: 25121 },
    { base: 25123, target: 25124 },
    { base: 25124, target: 25125 }
  ];

  for (const pair of pairs) {
    const record = await db.collection(collection).findOne({
      base_issue: pair.base,
      target_issue: pair.target
    });

    if (record) {
      console.log(`  ${pair.base} → ${pair.target}: ✅ 存在`);
    } else {
      console.log(`  ${pair.base} → ${pair.target}: ❌ 不存在`);
    }
  }

  await mongoose.connection.close();
}).catch(console.error);
