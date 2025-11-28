const mongoose = require('mongoose');

console.log('🔍 检查优化表的数据类型问题...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查1: 总记录数和is_predicted统计');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalCount = await db.collection(collection).countDocuments();
  console.log(`总记录数: ${totalCount}`);

  const predictedTrue = await db.collection(collection).countDocuments({ is_predicted: true });
  const predictedFalse = await db.collection(collection).countDocuments({ is_predicted: false });

  console.log(`is_predicted=true: ${predictedTrue}条`);
  console.log(`is_predicted=false: ${predictedFalse}条\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查2: 查找新保存的文档（字符串类型）');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 使用字符串类型查找
  const newDocString = await db.collection(collection).findOne({
    base_issue: "25124",
    target_issue: "25125"
  });

  if (newDocString) {
    console.log('✅ 找到新文档（字符串类型）！');
    console.log(`   _id: ${newDocString._id}`);
    console.log(`   base_issue: "${newDocString.base_issue}" (类型: ${typeof newDocString.base_issue})`);
    console.log(`   target_issue: "${newDocString.target_issue}" (类型: ${typeof newDocString.target_issue})`);
    console.log(`   is_predicted: ${newDocString.is_predicted}`);
    console.log(`   created_at: ${newDocString.created_at}\n`);
  } else {
    console.log('❌ 未找到新文档（字符串类型）\n');
  }

  // 使用数字类型查找
  const newDocNumber = await db.collection(collection).findOne({
    base_issue: 25124,
    target_issue: 25125
  });

  if (newDocNumber) {
    console.log('✅ 找到新文档（数字类型）！');
    console.log(`   _id: ${newDocNumber._id}`);
    console.log(`   base_issue: ${newDocNumber.base_issue} (类型: ${typeof newDocNumber.base_issue})`);
    console.log(`   target_issue: ${newDocNumber.target_issue} (类型: ${typeof newDocNumber.target_issue})`);
    console.log(`   is_predicted: ${newDocNumber.is_predicted}\n`);
  } else {
    console.log('❌ 未找到新文档（数字类型）\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查3: 查看旧数据的数据类型');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const oldDoc = await db.collection(collection).findOne({
    $or: [
      { base_issue: 9152 },
      { base_issue: "9152" }
    ]
  });

  if (oldDoc) {
    console.log('旧数据示例:');
    console.log(`   base_issue: ${oldDoc.base_issue} (类型: ${typeof oldDoc.base_issue})`);
    console.log(`   target_issue: ${oldDoc.target_issue} (类型: ${typeof oldDoc.target_issue})`);
    console.log(`   is_predicted: ${oldDoc.is_predicted}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查4: 查找所有is_predicted=true的文档');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const predictedDocs = await db.collection(collection)
    .find({ is_predicted: true })
    .toArray();

  console.log(`找到 ${predictedDocs.length} 条is_predicted=true的记录:\n`);

  predictedDocs.forEach((doc, idx) => {
    console.log(`${idx + 1}. ${doc.base_issue}→${doc.target_issue} (base_issue类型: ${typeof doc.base_issue})`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎬 问题诊断');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (newDocString && typeof newDocString.base_issue === 'string') {
    console.log('❌ 发现数据类型不一致问题！');
    console.log('   旧数据使用数字类型 (base_issue: 9152)');
    console.log('   新数据使用字符串类型 (base_issue: "25124")');
    console.log('');
    console.log('这会导致:');
    console.log('  1. 排序错误（字符串 "25124" < "9152"）');
    console.log('  2. 查询匹配失败（数字 25124 ≠ 字符串 "25124"）');
    console.log('  3. 前端显示最新期号时获取到旧数据');
    console.log('');
    console.log('解决方案: 需要修复server.js中保存数据的代码，将字符串转为数字！\n');
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
