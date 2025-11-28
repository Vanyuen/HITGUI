const mongoose = require('mongoose');

console.log('🔍 验证全量重建后的优化表状态...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 优化表基本信息');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalCount = await db.collection(collection).countDocuments();
  console.log(`总记录数: ${totalCount.toLocaleString()}`);
  console.log(`预期: 2791条 (7002→7003 到 25124→25125)\n`);

  // 检查最新记录
  const latestRecords = await db.collection(collection)
    .find({})
    .sort({ target_issue: -1 })
    .limit(5)
    .toArray();

  console.log('最新5条记录:');
  latestRecords.forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec.base_issue}→${rec.target_issue} (predicted: ${rec.is_predicted})`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎯 关键期号检查');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 检查推算期 25124→25125
  const predictedPeriod = await db.collection(collection).findOne({
    base_issue: 25124,
    target_issue: 25125
  });

  if (predictedPeriod) {
    console.log('✅ 推算期 25124→25125 存在！');
    console.log(`   is_predicted: ${predictedPeriod.is_predicted}`);
    console.log(`   记录数量: 1条\n`);
  } else {
    console.log('❌ 推算期 25124→25125 不存在！\n');
  }

  // 检查最后一个已开奖期 25123→25124
  const lastDrawnPeriod = await db.collection(collection).findOne({
    base_issue: 25123,
    target_issue: 25124
  });

  if (lastDrawnPeriod) {
    console.log('✅ 最后已开奖期 25123→25124 存在！');
    console.log(`   is_predicted: ${lastDrawnPeriod.is_predicted}\n`);
  } else {
    console.log('❌ 最后已开奖期 25123→25124 不存在！\n');
  }

  // 检查旧数据最后一期 9152→9153
  const oldDataLast = await db.collection(collection).findOne({
    base_issue: 9152,
    target_issue: 9153
  });

  if (oldDataLast) {
    console.log('✅ 旧数据最后期 9152→9153 仍存在');
    console.log(`   is_predicted: ${oldDataLast.is_predicted}\n`);
  } else {
    console.log('⚠️  旧数据 9152→9153 已被删除\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 is_predicted 统计');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const drawnCount = await db.collection(collection).countDocuments({ is_predicted: false });
  const predictedCount = await db.collection(collection).countDocuments({ is_predicted: true });

  console.log(`已开奖期 (is_predicted=false): ${drawnCount}条`);
  console.log(`推算期 (is_predicted=true): ${predictedCount}条`);
  console.log(`预期: 2790条已开奖 + 1条推算 = 2791条\n`);

  if (drawnCount === 2790 && predictedCount === 1) {
    console.log('✅ is_predicted 分布正确！\n');
  } else {
    console.log('❌ is_predicted 分布异常！\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎬 结论');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (totalCount === 2791 && predictedPeriod && drawnCount === 2790 && predictedCount === 1) {
    console.log('🎉 全量重建成功！优化表数据完全正确！');
    console.log('✅ 可以进行热温冷预测任务测试了！\n');
  } else {
    console.log('⚠️  优化表数据存在问题，需要进一步诊断！');
    console.log('\n问题清单:');
    if (totalCount !== 2791) {
      console.log(`  - 总记录数错误: 实际${totalCount}条，预期2791条`);
    }
    if (!predictedPeriod) {
      console.log(`  - 推算期25124→25125不存在`);
    }
    if (drawnCount !== 2790 || predictedCount !== 1) {
      console.log(`  - is_predicted分布错误: 已开奖${drawnCount}条，推算${predictedCount}条`);
    }
    console.log('');
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
