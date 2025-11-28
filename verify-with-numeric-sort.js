const mongoose = require('mongoose');

console.log('🔍 使用数字排序验证优化表...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 优化表基本信息');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalCount = await db.collection(collection).countDocuments();
  console.log(`总记录数: ${totalCount.toLocaleString()}`);
  console.log(`预期: 2791条 (7002→7003 到 25124→25125)\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 获取真正的最新记录（转换为数字排序）');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 获取所有记录，在内存中按数字排序
  const allDocs = await db.collection(collection)
    .find({})
    .project({ base_issue: 1, target_issue: 1, is_predicted: 1 })
    .toArray();

  // 按 target_issue 数字排序（降序）
  allDocs.sort((a, b) => {
    const targetA = parseInt(a.target_issue);
    const targetB = parseInt(b.target_issue);
    return targetB - targetA;
  });

  console.log('真正的最新5条记录（按数字排序）:');
  allDocs.slice(0, 5).forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec.base_issue}→${rec.target_issue} (predicted: ${rec.is_predicted})`);
  });

  const latest = allDocs[0];
  console.log(`\n✅ 最新期号对: ${latest.base_issue}→${latest.target_issue}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 is_predicted 统计');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const drawnCount = allDocs.filter(doc => !doc.is_predicted).length;
  const predictedCount = allDocs.filter(doc => doc.is_predicted).length;

  console.log(`已开奖期 (is_predicted=false): ${drawnCount}条`);
  console.log(`推算期 (is_predicted=true): ${predictedCount}条`);
  console.log(`总计: ${drawnCount + predictedCount}条\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 期号范围统计');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 按 target_issue 数字排序（升序）
  allDocs.sort((a, b) => {
    const targetA = parseInt(a.target_issue);
    const targetB = parseInt(b.target_issue);
    return targetA - targetB;
  });

  const first = allDocs[0];
  const last = allDocs[allDocs.length - 1];

  console.log(`最早期号对: ${first.base_issue}→${first.target_issue}`);
  console.log(`最新期号对: ${last.base_issue}→${last.target_issue}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎬 最终结论');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (totalCount === 2792 && last.target_issue === "25125" && predictedCount === 1) {
    console.log('⚠️  数据状态:');
    console.log(`   ✅ 最新期号正确: 25124→25125`);
    console.log(`   ✅ is_predicted分布正确: ${drawnCount}已开奖 + ${predictedCount}推算`);
    console.log(`   ⚠️  总记录数多1条: 实际${totalCount}条，预期2791条`);
    console.log('');
    console.log('可能原因:');
    console.log('  - 存在重复记录');
    console.log('  - 旧数据未完全清理\n');
    console.log('建议: 检查是否有重复的期号对\n');
  } else if (totalCount === 2791 && last.target_issue === "25125" && predictedCount === 1) {
    console.log('🎉 全量重建完全成功！');
    console.log(`   ✅ 总记录数: 2791条`);
    console.log(`   ✅ 最新期号: 25124→25125`);
    console.log(`   ✅ is_predicted分布: ${drawnCount}已开奖 + ${predictedCount}推算`);
    console.log('');
    console.log('可以进行热温冷预测任务测试了！\n');
  } else {
    console.log('❌ 数据仍有问题:');
    if (totalCount !== 2791) {
      console.log(`   - 总记录数: ${totalCount}（预期2791）`);
    }
    if (last.target_issue !== "25125") {
      console.log(`   - 最新期号: ${last.target_issue}（预期25125）`);
    }
    if (predictedCount !== 1) {
      console.log(`   - 推算期数量: ${predictedCount}（预期1）`);
    }
    console.log('');
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
